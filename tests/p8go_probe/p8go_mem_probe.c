#define _GNU_SOURCE

#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/uio.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

struct region {
    unsigned long start;
    unsigned long end;
};

static int read_remote(pid_t pid, unsigned long addr, unsigned char *buf, size_t len) {
    struct iovec local = { .iov_base = buf, .iov_len = len };
    struct iovec remote = { .iov_base = (void *)addr, .iov_len = len };
    ssize_t n = process_vm_readv(pid, &local, 1, &remote, 1, 0);
    return n == (ssize_t)len ? 0 : -1;
}

static int write_remote(pid_t pid, unsigned long addr, const unsigned char *buf, size_t len) {
    struct iovec local = { .iov_base = (void *)buf, .iov_len = len };
    struct iovec remote = { .iov_base = (void *)addr, .iov_len = len };
    ssize_t n = process_vm_writev(pid, &local, 1, &remote, 1, 0);
    return n == (ssize_t)len ? 0 : -1;
}

static long ms_since(struct timespec start, struct timespec end) {
    return (end.tv_sec - start.tv_sec) * 1000 + (end.tv_nsec - start.tv_nsec) / 1000000;
}

static long us_since(struct timespec start, struct timespec end) {
    return (end.tv_sec - start.tv_sec) * 1000000 + (end.tv_nsec - start.tv_nsec) / 1000;
}

static int load_regions(pid_t pid, struct region **out_regions, size_t *out_count) {
    char maps_path[128];
    snprintf(maps_path, sizeof(maps_path), "/proc/%d/maps", pid);
    FILE *maps = fopen(maps_path, "r");
    if (!maps) {
        return -1;
    }

    size_t cap = 64;
    size_t count = 0;
    struct region *regions = calloc(cap, sizeof(*regions));
    if (!regions) {
        fclose(maps);
        return -1;
    }

    char line[512];
    while (fgets(line, sizeof(line), maps)) {
        unsigned long start = 0, end = 0;
        char perms[5] = {0};
        if (sscanf(line, "%lx-%lx %4s", &start, &end, perms) != 3) {
            continue;
        }
        if (perms[0] != 'r' || perms[1] != 'w' || end <= start) {
            continue;
        }
        if (count == cap) {
            cap *= 2;
            struct region *next = realloc(regions, cap * sizeof(*regions));
            if (!next) {
                free(regions);
                fclose(maps);
                return -1;
            }
            regions = next;
        }
        regions[count++] = (struct region){ .start = start, .end = end };
    }
    fclose(maps);
    *out_regions = regions;
    *out_count = count;
    return 0;
}

static unsigned long find_marker(pid_t pid, struct region *regions, size_t region_count, long *scan_ms) {
    const unsigned char marker[] = { 0x70, 0x38, 0x67, 0x6f, 0x21 };
    unsigned char *buf = malloc(65536);
    if (!buf) {
        return 0;
    }

    struct timespec t0, t1;
    clock_gettime(CLOCK_MONOTONIC, &t0);

    for (size_t r = 0; r < region_count; r++) {
        for (unsigned long addr = regions[r].start; addr < regions[r].end; addr += 65536) {
            size_t want = regions[r].end - addr > 65536 ? 65536 : (size_t)(regions[r].end - addr);
            if (read_remote(pid, addr, buf, want) != 0) {
                continue;
            }
            for (size_t i = 0; i + sizeof(marker) <= want; i++) {
                if (memcmp(buf + i, marker, sizeof(marker)) == 0) {
                    clock_gettime(CLOCK_MONOTONIC, &t1);
                    if (scan_ms) {
                        *scan_ms = ms_since(t0, t1);
                    }
                    unsigned long found = addr + i;
                    free(buf);
                    return found;
                }
            }
        }
    }

    clock_gettime(CLOCK_MONOTONIC, &t1);
    if (scan_ms) {
        *scan_ms = ms_since(t0, t1);
    }
    free(buf);
    return 0;
}

static int poll_marker(pid_t pid, unsigned long marker_addr, int duration_ms, int interval_us) {
    unsigned long sample_addr = marker_addr >= 2 ? marker_addr - 2 : marker_addr;
    unsigned char buf[16] = {0};
    unsigned char last_seq = 0;
    int have_last = 0;
    int reads = 0;
    int failed = 0;
    int changed = 0;
    int stagnant = 0;
    int backward = 0;
    long total_us = 0;
    long worst_us = 0;

    struct timespec start, now;
    clock_gettime(CLOCK_MONOTONIC, &start);

    for (;;) {
        clock_gettime(CLOCK_MONOTONIC, &now);
        if (ms_since(start, now) >= duration_ms) {
            break;
        }

        struct timespec r0, r1;
        clock_gettime(CLOCK_MONOTONIC, &r0);
        int ok = read_remote(pid, sample_addr, buf, sizeof(buf));
        clock_gettime(CLOCK_MONOTONIC, &r1);
        long read_us = us_since(r0, r1);
        total_us += read_us;
        if (read_us > worst_us) {
            worst_us = read_us;
        }

        reads++;
        if (ok != 0) {
            failed++;
        } else {
            unsigned char seq = buf[1];
            if (have_last) {
                int delta = (seq - last_seq) & 0xff;
                if (delta == 0) {
                    stagnant++;
                } else if (delta > 128) {
                    backward++;
                } else {
                    changed++;
                }
            }
            last_seq = seq;
            have_last = 1;
        }

        usleep(interval_us);
    }

    printf(
        "POLL reads=%d failed=%d changed=%d stagnant=%d backward=%d avg_read_us=%ld worst_read_us=%ld last_bytes=",
        reads,
        failed,
        changed,
        stagnant,
        backward,
        reads > 0 ? total_us / reads : 0,
        worst_us
    );
    for (size_t i = 0; i < sizeof(buf); i++) {
        printf("%02x", buf[i]);
    }
    printf("\n");

    return failed == 0 && changed > 0 && backward == 0 ? 0 : 4;
}

static int write_ack_test(pid_t pid, unsigned long marker_addr) {
    unsigned long host_addr = marker_addr + 15;
    unsigned long ack_addr = marker_addr + 16;
    unsigned char value = 0x42;
    unsigned char ack = 0;

    if (write_remote(pid, host_addr, &value, 1) != 0) {
        printf("WRITE_ACK write_failed errno=%d\n", errno);
        return 5;
    }

    for (int i = 0; i < 30; i++) {
        usleep(16000);
        if (read_remote(pid, ack_addr, &ack, 1) == 0 && ack == (unsigned char)(value + 1)) {
            printf("WRITE_ACK ok host_addr=0x%lx ack_addr=0x%lx value=%02x ack=%02x polls=%d\n", host_addr, ack_addr, value, ack, i + 1);
            return 0;
        }
    }

    printf("WRITE_ACK no_ack host_addr=0x%lx ack_addr=0x%lx value=%02x ack=%02x\n", host_addr, ack_addr, value, ack);
    return 6;
}

int main(int argc, char **argv) {
    int duration_ms = argc >= 5 ? atoi(argv[4]) : 0;
    int interval_us = argc >= 6 ? atoi(argv[5]) : 16000;
    int do_write_ack = argc >= 7 ? atoi(argv[6]) : 0;

    if (argc < 4 || argc > 7) {
        fprintf(stderr, "usage: %s <pico8> <home> <cart> [poll_ms] [interval_us] [write_ack]\n", argv[0]);
        return 2;
    }

    pid_t pid = fork();
    if (pid < 0) {
        perror("fork");
        return 1;
    }

    if (pid == 0) {
        execl(argv[1], argv[1], "-home", argv[2], "-x", argv[3], (char *)NULL);
        perror("execl");
        _exit(127);
    }

    usleep(300000);

    struct region *regions = NULL;
    size_t region_count = 0;
    if (load_regions(pid, &regions, &region_count) != 0) {
        perror("load regions");
        kill(pid, SIGTERM);
        waitpid(pid, NULL, 0);
        return 1;
    }

    long scan_ms = 0;
    unsigned long found = find_marker(pid, regions, region_count, &scan_ms);
    unsigned char found_buf[16] = {0};

    if (found) {
        unsigned long sample_addr = found >= 2 ? found - 2 : found;
        read_remote(pid, sample_addr, found_buf, sizeof(found_buf));
        printf("FOUND marker_addr=0x%lx scan_ms=%ld bytes=", found, scan_ms);
        for (size_t i = 0; i < sizeof(found_buf); i++) {
            printf("%02x", found_buf[i]);
        }
        printf("\n");
    } else {
        printf("NOT_FOUND scan_ms=%ld errno=%d\n", scan_ms, errno);
    }

    int result = found ? 0 : 3;
    if (found && duration_ms > 0) {
        result = poll_marker(pid, found, duration_ms, interval_us);
    }
    if (found && do_write_ack) {
        int write_result = write_ack_test(pid, found);
        if (result == 0) {
            result = write_result;
        }
    }

    free(regions);
    kill(pid, SIGTERM);
    waitpid(pid, NULL, 0);
    return result;
}

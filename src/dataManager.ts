import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export interface GameMetadata {
    id: string;
    name: string;
    description?: string;
    author: {
        name: string;
        url?: string;
    };
    source: string;
    extension: {
        cart_url?: string;
        thumbnail_path?: string;
        [key: string]: any;
    };
    [key: string]: any;
}

export class DataManager {
    private context: vscode.ExtensionContext;
    private assetsDir: string = '';
    private cachedDbPath: string = '';
    private dbMetaPath: string = '';  // Stores ETag/Last-Modified for version checking
    private onUpdateAvailable?: (gameCount: number) => void;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.assetsDir = path.join(context.globalStorageUri.fsPath, 'assets');
        this.cachedDbPath = path.join(context.globalStorageUri.fsPath, 'db.json');
        this.dbMetaPath = path.join(context.globalStorageUri.fsPath, 'db_meta.json');
    }

    // Set callback for when update is available
    public setUpdateCallback(callback: (gameCount: number) => void) {
        this.onUpdateAvailable = callback;
    }

    // Initialize directories
    public async initialize(): Promise<void> {
        if (!fs.existsSync(this.context.globalStorageUri.fsPath)) {
            fs.mkdirSync(this.context.globalStorageUri.fsPath, { recursive: true });
        }
        if (!fs.existsSync(this.assetsDir)) {
            fs.mkdirSync(this.assetsDir, { recursive: true });
        }
    }

    public async getGames(): Promise<GameMetadata[]> {
        const config = vscode.workspace.getConfiguration('pico8ide');
        const mode = config.get<string>('dataMode') || 'remote';

        if (mode === 'local') {
            const localPath = config.get<string>('localPath');
            if (!localPath) {
                vscode.window.showErrorMessage('PICO-8 IDE: Local path not configured.');
                return [];
            }
            const dbPath = path.join(localPath, 'db.json');
            if (fs.existsSync(dbPath)) {
                 try {
                     const data = fs.readFileSync(dbPath, 'utf8');
                     return JSON.parse(data);
                 } catch (e) {
                     console.error("Error reading local DB", e);
                     return [];
                 }
            }
            return [];
        }

        // Remote mode: Load cached first, then check for updates
        const remoteUrl = config.get<string>('remoteUrl') || 'https://github.com/hp7hao/fcdb/releases/latest/download/db_pico8.json';

        // 1. Try to load cached database first
        let cachedGames: GameMetadata[] = [];
        if (fs.existsSync(this.cachedDbPath)) {
            try {
                const data = fs.readFileSync(this.cachedDbPath, 'utf8');
                cachedGames = JSON.parse(data);
                console.log(`[DataManager] Loaded ${cachedGames.length} games from cache`);
            } catch (e) {
                console.error("Error reading cached DB", e);
            }
        }

        // 2. If we have cached data, check for updates in background
        if (cachedGames.length > 0) {
            this.checkForUpdates(remoteUrl);
            return cachedGames;
        }

        // 3. No cache - need to download
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Downloading PICO-8 Database...",
                cancellable: false
            }, async () => {
                await this.downloadDatabase(remoteUrl);
            });

            if (fs.existsSync(this.cachedDbPath)) {
                const data = fs.readFileSync(this.cachedDbPath, 'utf8');
                return JSON.parse(data);
            }
        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to download database: ${e.message}`);
        }

        return [];
    }

    // Check for database updates in background
    private async checkForUpdates(remoteUrl: string): Promise<void> {
        try {
            // Get current metadata
            let currentMeta: { etag?: string; lastModified?: string; gameCount?: number } = {};
            if (fs.existsSync(this.dbMetaPath)) {
                currentMeta = JSON.parse(fs.readFileSync(this.dbMetaPath, 'utf8'));
            }

            // Check remote headers
            const headers = await this.getRemoteHeaders(remoteUrl);
            const remoteEtag = headers['etag'];
            const remoteLastModified = headers['last-modified'];

            // Compare versions
            const hasNewVersion = (remoteEtag && remoteEtag !== currentMeta.etag) ||
                                  (remoteLastModified && remoteLastModified !== currentMeta.lastModified);

            if (hasNewVersion) {
                console.log('[DataManager] New database version available');

                const choice = await vscode.window.showInformationMessage(
                    'A new PICO-8 game database is available. Update now?',
                    'Update',
                    'Later'
                );

                if (choice === 'Update') {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "Updating PICO-8 Database...",
                        cancellable: false
                    }, async () => {
                        await this.downloadDatabase(remoteUrl);
                    });

                    // Notify about update
                    if (this.onUpdateAvailable) {
                        const data = fs.readFileSync(this.cachedDbPath, 'utf8');
                        const games = JSON.parse(data);
                        this.onUpdateAvailable(games.length);
                    }
                }
            } else {
                console.log('[DataManager] Database is up to date');
            }
        } catch (e) {
            console.warn('[DataManager] Failed to check for updates:', e);
        }
    }

    // Download database and save metadata
    private async downloadDatabase(remoteUrl: string): Promise<void> {
        const tempPath = this.cachedDbPath + '.tmp';
        await this.downloadFile(remoteUrl, tempPath);

        // Validate JSON before replacing
        try {
            const data = fs.readFileSync(tempPath, 'utf8');
            const games = JSON.parse(data);

            // Save the validated database
            fs.renameSync(tempPath, this.cachedDbPath);

            // Save metadata
            const headers = await this.getRemoteHeaders(remoteUrl);
            const meta = {
                etag: headers['etag'],
                lastModified: headers['last-modified'],
                gameCount: games.length,
                downloadedAt: new Date().toISOString()
            };
            fs.writeFileSync(this.dbMetaPath, JSON.stringify(meta, null, 2));

            console.log(`[DataManager] Downloaded database: ${games.length} games`);
        } catch (e) {
            // Remove invalid temp file
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
            throw e;
        }
    }

    // Get remote file headers (for version checking)
    private getRemoteHeaders(url: string): Promise<Record<string, string>> {
        return new Promise((resolve, reject) => {
            const options = {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 PICO-8 IDE Extension'
                }
            };

            const req = https.request(url, options, (res) => {
                // Handle redirects
                if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
                    this.getRemoteHeaders(res.headers.location).then(resolve).catch(reject);
                    return;
                }

                const headers: Record<string, string> = {};
                if (res.headers.etag) headers['etag'] = res.headers.etag as string;
                if (res.headers['last-modified']) headers['last-modified'] = res.headers['last-modified'] as string;
                resolve(headers);
            });

            req.on('error', reject);
            req.end();
        });
    }

    public async getAssetPath(game: GameMetadata, type: 'cart' | 'thumb'): Promise<string> {
        const config = vscode.workspace.getConfiguration('pico8ide');
        const mode = config.get<string>('dataMode') || 'remote';

        // Local mode: direct mapping
        if (mode === 'local') {
             const localPath = config.get<string>('localPath');
             if (!localPath) throw new Error('Local path for assets not configured');

             // Layout in fcdb/dist/pico8:
             // carts/bbs/{id}.p8.png
             // thumbs/bbs/{id}.png
             const subDir = type === 'cart' ? 'carts' : 'thumbs';
             const ext = type === 'cart' ? '.p8.png' : '.png';
             // source is usually 'bbs'
             return path.join(localPath, subDir, game.source || 'bbs', `${game.id}${ext}`);
        }

        // Remote mode: check cache first, then download from Lexaloffle
        const cacheDir = path.join(this.assetsDir, type === 'cart' ? 'carts' : 'thumbs', game.source || 'bbs');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        const ext = type === 'cart' ? '.p8.png' : '.png';
        const fileName = `${game.id}${ext}`;
        const filePath = path.join(cacheDir, fileName);

        if (fs.existsSync(filePath)) {
            return filePath;
        }

        // Download logic
        let sourceUrl = '';
        const thumbnailPath = game.extension.thumbnail_path || '';

        if (type === 'cart') {
             // 1. Try computed from thumbnail path (most reliable for BBS)
             const computed = this.computeCartUrl(thumbnailPath);
             // 2. Try explicit URL
             const explicit = game.extension.cart_url;
             // 3. Fallback to ID-based (often fails for recent carts if path logic not perfect)
             // Default fallback (though computeCartUrl usually covers it)
             const fallback = `https://www.lexaloffle.com/bbs/cposts/${game.id}.p8.png`;

             sourceUrl = computed || explicit || fallback;
        } else {
             // Thumbnail
             if (thumbnailPath.startsWith('http')) {
                sourceUrl = thumbnailPath;
            } else {
                sourceUrl = `https://www.lexaloffle.com${thumbnailPath}`;
            }
        }

        console.log(`[DataManager] Downloading ${type} from: ${sourceUrl}`);

        try {
            await this.downloadFile(sourceUrl, filePath);
            return filePath;
        } catch (e: any) {
            console.error(`Failed to download ${type}: ${sourceUrl}, Error: ${e.message}`);
            throw new Error(`Failed to download ${type} from ${sourceUrl}. Reason: ${e.message}`);
        }
    }

    // Get path to cached extracted thumbnail (label from cart PNG)
    public getExtractedThumbPath(game: GameMetadata): string {
        const thumbDir = path.join(this.assetsDir, 'thumbs_extracted', game.source || 'bbs');
        if (!fs.existsSync(thumbDir)) {
            fs.mkdirSync(thumbDir, { recursive: true });
        }
        return path.join(thumbDir, `${game.id}.png`);
    }

    // Check if extracted thumbnail exists
    public hasExtractedThumb(game: GameMetadata): boolean {
        return fs.existsSync(this.getExtractedThumbPath(game));
    }

    // Save extracted thumbnail (base64 data URL to file)
    public saveExtractedThumb(game: GameMetadata, base64DataUrl: string): void {
        const thumbPath = this.getExtractedThumbPath(game);
        // Remove data URL prefix: "data:image/png;base64,"
        const base64Data = base64DataUrl.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(thumbPath, Buffer.from(base64Data, 'base64'));
        console.log(`[DataManager] Saved extracted thumbnail: ${thumbPath}`);
    }

    // Load extracted thumbnail as data URL
    public loadExtractedThumb(game: GameMetadata): string | null {
        const thumbPath = this.getExtractedThumbPath(game);
        if (fs.existsSync(thumbPath)) {
            const data = fs.readFileSync(thumbPath);
            return `data:image/png;base64,${data.toString('base64')}`;
        }
        return null;
    }

    private computeCartUrl(thumbnailPath: string): string | null {
        if (!thumbnailPath) return null;

        // If the thumbnail path is already pointing to 'cposts', it's likely the cart path (BBS thumbnails often are the cart, or a smaller png in thumbs/)
        // In the scraper, we grab the src of the image.
        // Recent BBS: src is /bbs/cposts/X/YYYYY.p8.png

        if (thumbnailPath.includes('cposts')) {
             let url = thumbnailPath;
             if (!url.startsWith('http')) {
                 url = `https://www.lexaloffle.com${url}`;
             }
             // Ensure extension is .p8.png (sometimes thumbs might be .png but cart is .p8.png)
             if (!url.endsWith('.p8.png')) {
                 url = url.replace('.png', '.p8.png');
             }
             return url;
        }

        // New Logic: parse from filename patterns
        const basename = path.basename(thumbnailPath, path.extname(thumbnailPath));

        // Case A: picoXXXXX (digits) -> cposts/x/xxxxx.p8.png
        // Example: pico12345 -> 12345 -> folder '1'
        const matchDigits = basename.match(/^pico(\d+)$/);
        if (matchDigits) {
            const id = matchDigits[1]; // "12345"
            if (id.length > 0) {
                const folder = id.charAt(0); // "1"
                return `https://www.lexaloffle.com/bbs/cposts/${folder}/${id}.p8.png`;
            }
        }

        // Case B: pico8_XXXXX (alphanumeric) -> cposts/xx/xxxxx.p8.png
        // Example: pico8_mygame -> mygame -> folder 'my'
        // If xxxxx is not a number, strict check? Or just else?
        const matchString = basename.match(/^pico8_(.+)$/);
        if (matchString) {
            const id = matchString[1]; // "mygame"
            // Ensure folder length is sufficient, or fallback?
            if (id.length >= 1) {
                // If it's short, just use full id or first char? User said "xx".
                // Assuming >=2 chars usually for named things.
                const folder = id.length >= 2 ? id.substring(0, 2) : id;
                return `https://www.lexaloffle.com/bbs/cposts/${folder}/${id}.p8.png`;
            }
        }

        return null;
    }

    private downloadFile(url: string, destPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log(`[DataManager] Starting download: ${url} -> ${destPath}`);
            const file = fs.createWriteStream(destPath);
            const options = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': '*/*'
                },
                timeout: 30000
            };

            const request = https.get(url, options, (response) => {
                console.log(`[DataManager] Response status: ${response.statusCode} for ${url}`);

                // Determine redirect URL properly
                if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
                    if (response.headers.location) {
                         // Must close current file write stream before recursive call
                         file.close();

                         // Handle relative redirects
                         let redirectUrl = response.headers.location;
                         if (!redirectUrl.startsWith('http')) {
                             const u = new URL(url);
                             redirectUrl = `${u.protocol}//${u.host}${redirectUrl}`;
                         }
                         console.log(`[DataManager] Redirecting to: ${redirectUrl}`);

                         this.downloadFile(redirectUrl, destPath)
                            .then(resolve)
                            .catch(reject);
                         return;
                    }
                }

                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlink(destPath, () => {});
                    reject(new Error(`Status Code: ${response.statusCode} for ${url}`));
                    return;
                }

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    console.log(`[DataManager] Download complete: ${destPath}`);
                    resolve();
                });
            });

            request.on('timeout', () => {
                request.destroy();
                fs.unlink(destPath, () => {});
                reject(new Error(`Request timed out for ${url}`));
            });

            request.on('error', (err) => {
                console.error(`[DataManager] Request error: ${err.message}`);
                fs.unlink(destPath, () => {});
                reject(err);
            });

            file.on('error', (err) => {
                 console.error(`[DataManager] File write error: ${err.message}`);
                 fs.unlink(destPath, () => {});
                 reject(err);
            });
        });
    }
}

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

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.assetsDir = path.join(context.globalStorageUri.fsPath, 'assets');
    }

    // Initialize directories
    public async initialize(): Promise<void> {
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
        } else {
             // Remote mode
             const remoteUrl = config.get<string>('remoteUrl') || 'https://github.com/hp7hao/fcdb/releases/latest/download/db_pico8.json';
             // Cache DB locally
             if (!fs.existsSync(this.context.globalStorageUri.fsPath)) {
                 fs.mkdirSync(this.context.globalStorageUri.fsPath, { recursive: true });
             }
             const cachedDbPath = path.join(this.context.globalStorageUri.fsPath, 'db.json');

             try {
                 // Always try to fetch latest DB
                 // Use VSCode progress
                 await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Fetching PICO-8 Database...",
                    cancellable: false
                 }, async (progress) => {
                    await this.downloadFile(remoteUrl, cachedDbPath);
                 });
             } catch (e) {
                 console.warn('Failed to fetch remote DB, using cache if available', e);
             }

             if (fs.existsSync(cachedDbPath)) {
                 try {
                     const data = fs.readFileSync(cachedDbPath, 'utf8');
                     const parsed = JSON.parse(data);
                     return parsed;
                 } catch (e) {
                     console.error("Error reading cached DB", e);
                     vscode.window.showErrorMessage("Error reading DB cache. Please restart or check logs.");
                     return [];
                 }
             }
             return [];
        }
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

             // Override based on user feedback about ID structure if compute fails or we want to double check
             if (!computed && !explicit) {
                  // User said:
                  // if picoXXXXX (number): cposts/x/xxxx.p8.png (where x is ? maybe not just x)
                  // if pico8_xxxxxx: cposts/xx/xxxxxx.p8.png
                  // This is complicated to guess without exact logic.
                  // But thumbnail_path usually has the pattern.
                  // Example thumb: /bbs/cposts/1/12345.p8.png (often thumb IS the cart image)
                  // Or /bbs/thumbs/p12345.png
             }
        } else {
             // Thumbnail
             if (thumbnailPath.startsWith('http')) {
                sourceUrl = thumbnailPath;
            } else {
                sourceUrl = `https://www.lexaloffle.com${thumbnailPath}`;
            }
        }

        vscode.window.showInformationMessage(`Attempting download for ${type} from: ${sourceUrl}`);

        try {
            console.log(`Downloading ${type} from: ${sourceUrl}`);
            await this.downloadFile(sourceUrl, filePath);
            return filePath;
        } catch (e: any) {
            console.error(`Failed to download ${type}: ${sourceUrl}, Error: ${e.message}`);
            // If first attempt fails and we used a computed URL, maybe try fallback?
            // For now, throw.
            throw new Error(`Failed to download ${type} from ${sourceUrl}. Reason: ${e.message}`);
        }
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
            const file = fs.createWriteStream(destPath);
            const options = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': '*/*'
                }
            };

            const request = https.get(url, options, (response) => {
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
                    resolve();
                });
            });

            request.on('error', (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });

            file.on('error', (err) => {
                 fs.unlink(destPath, () => {});
                 reject(err);
            });
        });
    }
}

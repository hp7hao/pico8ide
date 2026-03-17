import { CartData, MetaData } from './cartData';
import { cartDataToP8, p8ToCartData } from './p8format';

/**
 * Serialize CartData + MetaData to .p8mod text format.
 * Standard sections are identical to .p8, with optional __meta__ and __i18n__ JSON sections appended.
 */
export function cartDataToP8Mod(cartData: CartData, metaData: MetaData | null): string {
    // Get standard .p8 content (ends with trailing newline)
    let text = cartDataToP8(cartData);

    if (metaData) {
        if (metaData.meta && (metaData.meta.title || metaData.meta.author || metaData.meta.template !== 'default')) {
            text += '__meta__\n';
            text += JSON.stringify(metaData.meta, null, 2) + '\n';
        }

        if (metaData.i18n && (metaData.i18n.locales.length > 0 || metaData.i18n.entries.length > 0)) {
            text += '__i18n__\n';
            text += JSON.stringify(metaData.i18n, null, 2) + '\n';
        }
    }

    return text;
}

/**
 * Parse .p8mod text format to CartData + MetaData.
 * Splits out __meta__ and __i18n__ JSON sections, delegates the rest to p8ToCartData().
 */
export function p8ModToCartData(text: string): { cartData: CartData; metaData: MetaData | null } {
    // Extract __meta__ and __i18n__ sections and remove them from text before passing to p8ToCartData
    const sectionRegex = /^__(\w+)__$/gm;
    const sections: { name: string; start: number; contentStart: number }[] = [];
    let match;

    while ((match = sectionRegex.exec(text)) !== null) {
        sections.push({
            name: match[1],
            start: match.index,
            contentStart: match.index + match[0].length + 1 // +1 for newline
        });
    }

    let metaJson: string | null = null;
    let i18nJson: string | null = null;
    let standardText = text;

    // Find meta and i18n sections (must be extracted before passing to p8ToCartData)
    const customSections: { name: string; start: number; end: number }[] = [];

    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const nextStart = i + 1 < sections.length ? sections[i + 1].start : text.length;
        const content = text.substring(section.contentStart, nextStart).trim();

        if (section.name === 'meta') {
            metaJson = content;
            customSections.push({ name: 'meta', start: section.start, end: nextStart });
        } else if (section.name === 'i18n') {
            i18nJson = content;
            customSections.push({ name: 'i18n', start: section.start, end: nextStart });
        }
    }

    // Remove custom sections from text (in reverse order to preserve offsets)
    if (customSections.length > 0) {
        customSections.sort((a, b) => b.start - a.start);
        for (const cs of customSections) {
            standardText = standardText.substring(0, cs.start) + standardText.substring(cs.end);
        }
    }

    // Parse standard .p8 sections
    const cartData = p8ToCartData(standardText);

    // Parse JSON sections
    let metaData: MetaData | null = null;

    const parsedMeta = metaJson ? tryParseJson(metaJson) : null;
    const parsedI18n = i18nJson ? tryParseJson(i18nJson) : null;

    if (parsedMeta || parsedI18n) {
        metaData = {
            meta: parsedMeta || { title: '', author: '', template: 'default' },
            i18n: parsedI18n || { locales: [], entries: [], outputLocale: '' }
        };
    }

    return { cartData, metaData };
}

/**
 * Convert a CartData + MetaData into .p8mod text.
 * Convenience alias for cartDataToP8Mod.
 */
export function convertToP8Mod(cartData: CartData, metaData: MetaData | null): string {
    return cartDataToP8Mod(cartData, metaData);
}

/**
 * Generate a blank .p8mod template for new cartridges.
 */
export function blankP8Mod(): string {
    const cartData: CartData = {
        code: '--#include vec2\n-- new cartridge\n-- use tx() for i18n strings\n-- use --#include to add libs\n\nfunction _init()\n _txi()\n pos=v2(64,64)\n spd=v2(1,0.5)\n t=0\nend\n\nfunction _update()\n t+=1\n pos=v2add(pos,spd)\n if pos.x>120 or pos.x<8 then spd.x=-spd.x end\n if pos.y>120 or pos.y<8 then spd.y=-spd.y end\nend\n\nfunction _draw()\n cls(1)\n circfill(pos.x,pos.y,4,7)\n tx("hello",40,60,10)\nend\n',
        gfx: new Array(8192).fill(0),
        map: new Array(4096).fill(0),
        gfxFlags: new Array(256).fill(0),
        music: new Array(256).fill(0),
        sfx: new Array(4352).fill(0),
        label: ''
    };
    const metaData: MetaData = {
        meta: { title: '', author: '', template: 'default' },
        i18n: {
            locales: ['zh'],
            entries: [
                { key: 'hello', translations: { zh: '\u4f60\u597d\u4e16\u754c' } }
            ],
            outputLocale: 'zh'
        }
    };
    return cartDataToP8Mod(cartData, metaData);
}

/**
 * Generate an i18n demo .p8mod with a "daily poetry" themed game
 * featuring hundreds of unique Chinese characters from classical poems.
 */
export function i18nDemoP8Mod(): string {
    // Daily motto / inspirational quotes game
    // Each quote uses many unique Chinese characters
    const quotes: { key: string; zh: string }[] = [
        // --- Classic philosophy & Confucius ---
        { key: 'q1', zh: '千里之行，\n始于足下。' },
        { key: 'q2', zh: '学而不思则罔，\n思而不学则殆。' },
        { key: 'q3', zh: '天行健，\n君子以自强不息。' },
        { key: 'q4', zh: '地势坤，\n君子以厚德载物。' },
        { key: 'q5', zh: '知己知彼，\n百战不殆。' },
        { key: 'q6', zh: '温故而知新，\n可以为师矣。' },
        { key: 'q7', zh: '三人行，\n必有我师焉。' },
        { key: 'q8', zh: '路漫漫其修远兮，\n吾将上下而求索。' },
        { key: 'q9', zh: '宝剑锋从磨砺出，\n梅花香自苦寒来。' },
        { key: 'q10', zh: '书山有路勤为径，\n学海无涯苦作舟。' },
        // --- Diligence & Study ---
        { key: 'q11', zh: '业精于勤荒于嬉，\n行成于思毁于随。' },
        { key: 'q12', zh: '黑发不知勤学早，\n白首方悔读书迟。' },
        { key: 'q13', zh: '少壮不努力，\n老大徒伤悲。' },
        { key: 'q14', zh: '欲穷千里目，\n更上一层楼。' },
        { key: 'q15', zh: '海内存知己，\n天涯若比邻。' },
        { key: 'q16', zh: '落霞与孤鹜齐飞，\n秋水共长天一色。' },
        { key: 'q17', zh: '人生自古谁无死？\n留取丹心照汗青。' },
        { key: 'q18', zh: '春蚕到死丝方尽，\n蜡炬成灰泪始干。' },
        { key: 'q19', zh: '先天下之忧而忧，\n后天下之乐而乐。' },
        { key: 'q20', zh: '静以修身，\n俭以养德。' },
        // --- Perseverance ---
        { key: 'q21', zh: '不积跬步，\n无以至千里。' },
        { key: 'q22', zh: '长风破浪会有时，\n直挂云帆济沧海。' },
        { key: 'q23', zh: '山重水复疑无路，\n柳暗花明又一村。' },
        { key: 'q24', zh: '横看成岭侧成峰，\n远近高低各不同。' },
        { key: 'q25', zh: '大江东去，浪淘尽，\n千古风流人物。' },
        { key: 'q26', zh: '明月几时有？\n把酒问青天。' },
        { key: 'q27', zh: '但愿人长久，\n千里共婵娟。' },
        { key: 'q28', zh: '采菊东篱下，\n悠然见南山。' },
        { key: 'q29', zh: '会当凌绝顶，\n一览众山小。' },
        { key: 'q30', zh: '桃李不言，\n下自成蹊。' },
        // --- Nature & Seasons ---
        { key: 'q31', zh: '春风得意马蹄疾，\n一日看尽长安花。' },
        { key: 'q32', zh: '接天莲叶无穷碧，\n映日荷花别样红。' },
        { key: 'q33', zh: '停车坐爱枫林晚，\n霜叶红于二月花。' },
        { key: 'q34', zh: '忽如一夜春风来，\n千树万树梨花开。' },
        { key: 'q35', zh: '竹外桃花三两枝，\n春江水暖鸭先知。' },
        { key: 'q36', zh: '碧玉妆成一树高，\n万条垂下绿丝绦。' },
        { key: 'q37', zh: '野火烧不尽，\n春风吹又生。' },
        { key: 'q38', zh: '日出江花红胜火，\n春来江水绿如蓝。' },
        { key: 'q39', zh: '两个黄鹂鸣翠柳，\n一行白鹭上青天。' },
        { key: 'q40', zh: '小荷才露尖尖角，\n早有蜻蜓立上头。' },
        // --- Friendship & Parting ---
        { key: 'q41', zh: '莫愁前路无知己，\n天下谁人不识君。' },
        { key: 'q42', zh: '劝君更尽一杯酒，\n西出阳关无故人。' },
        { key: 'q43', zh: '孤帆远影碧空尽，\n唯见长江天际流。' },
        { key: 'q44', zh: '桃花潭水深千尺，\n不及汪伦送我情。' },
        { key: 'q45', zh: '浮云游子意，\n落日故人情。' },
        { key: 'q46', zh: '春草明年绿，\n王孙归不归？' },
        { key: 'q47', zh: '相见时难别亦难，\n东风无力百花残。' },
        { key: 'q48', zh: '洛阳亲友如相问，\n一片冰心在玉壶。' },
        { key: 'q49', zh: '独在异乡为异客，\n每逢佳节倍思亲。' },
        { key: 'q50', zh: '遥知兄弟登高处，\n遍插茱萸少一人。' },
        // --- Ambition & Aspiration ---
        { key: 'q51', zh: '老骥伏枥，\n志在千里。' },
        { key: 'q52', zh: '烈士暮年，\n壮心不已。' },
        { key: 'q53', zh: '生当作人杰，\n死亦为鬼雄。' },
        { key: 'q54', zh: '粉骨碎身浑不怕，\n要留清白在人间。' },
        { key: 'q55', zh: '苟利国家生死以，\n岂因祸福避趋之。' },
        { key: 'q56', zh: '壮志饥餐胡虏肉，\n笑谈渴饮匈奴血。' },
        { key: 'q57', zh: '男儿何不带吴钩，\n收取关山五十州。' },
        { key: 'q58', zh: '黄沙百战穿金甲，\n不破楼兰终不还。' },
        { key: 'q59', zh: '青山处处埋忠骨，\n何须马革裹尸还。' },
        { key: 'q60', zh: '位卑未敢忘忧国，\n事定犹须待阖棺。' },
        // --- Wisdom & Philosophy ---
        { key: 'q61', zh: '纸上得来终觉浅，\n绝知此事要躬行。' },
        { key: 'q62', zh: '问渠那得清如许？\n为有源头活水来。' },
        { key: 'q63', zh: '不畏浮云遮望眼，\n自缘身在最高层。' },
        { key: 'q64', zh: '沉舟侧畔千帆过，\n病树前头万木春。' },
        { key: 'q65', zh: '旧时王谢堂前燕，\n飞入寻常百姓家。' },
        { key: 'q66', zh: '人有悲欢离合，\n月有阴晴圆缺。' },
        { key: 'q67', zh: '世事洞明皆学问，\n人情练达即文章。' },
        { key: 'q68', zh: '读书破万卷，\n下笔如有神。' },
        { key: 'q69', zh: '吾生也有涯，\n而知也无涯。' },
        { key: 'q70', zh: '博学之，审问之，\n慎思之，明辨之，\n笃行之。' },
        // --- Moonlight & Night ---
        { key: 'q71', zh: '床前明月光，\n疑是地上霜。' },
        { key: 'q72', zh: '举头望明月，\n低头思故乡。' },
        { key: 'q73', zh: '春花秋月何时了？\n往事知多少。' },
        { key: 'q74', zh: '今人不见古时月，\n今月曾经照古人。' },
        { key: 'q75', zh: '星垂平野阔，\n月涌大江流。' },
        { key: 'q76', zh: '露从今夜白，\n月是故乡明。' },
        { key: 'q77', zh: '深林人不知，\n明月来相照。' },
        { key: 'q78', zh: '海上生明月，\n天涯共此时。' },
        { key: 'q79', zh: '峨眉山月半轮秋，\n影入平羌江水流。' },
        { key: 'q80', zh: '秦时明月汉时关，\n万里长征人未还。' },
        // --- Life & Emotion ---
        { key: 'q81', zh: '天生我材必有用，\n千金散尽还复来。' },
        { key: 'q82', zh: '此情可待成追忆，\n只是当时已惘然。' },
        { key: 'q83', zh: '曾经沧海难为水，\n除却巫山不是云。' },
        { key: 'q84', zh: '身无彩凤双飞翼，\n心有灵犀一点通。' },
        { key: 'q85', zh: '抽刀断水水更流，\n举杯消愁愁更愁。' },
        { key: 'q86', zh: '同是天涯沦落人，\n相逢何必曾相识。' },
        { key: 'q87', zh: '夕阳无限好，\n只是近黄昏。' },
        { key: 'q88', zh: '我劝天公重抖擞，\n不拘一格降人才。' },
        { key: 'q89', zh: '江山代有才人出，\n各领风骚数百年。' },
        { key: 'q90', zh: '谁言寸草心，\n报得三春晖。' },
        // --- War & History ---
        { key: 'q91', zh: '醉卧沙场君莫笑，\n古来征战几人回？' },
        { key: 'q92', zh: '出师未捷身先死，\n长使英雄泪满襟。' },
        { key: 'q93', zh: '商女不知亡国恨，\n隔江犹唱后庭花。' },
        { key: 'q94', zh: '东风不与周郎便，\n铜雀春深锁二乔。' },
        { key: 'q95', zh: '功盖三分国，\n名成八阵图。' },
        { key: 'q96', zh: '国破山河在，\n城春草木深。' },
        { key: 'q97', zh: '烽火连三月，\n家书抵万金。' },
        { key: 'q98', zh: '白日放歌须纵酒，\n青春作伴好还乡。' },
        { key: 'q99', zh: '安得广厦千万间，\n大庇天下寒士俱欢颜。' },
        { key: 'q100', zh: '朱门酒肉臭，\n路有冻死骨。' },
        // --- UI strings ---
        { key: 'title', zh: '每日诗词' },
        { key: 'author', zh: '古典诗词' },
        { key: 'hint', zh: '按左右键翻页' },
        { key: 'page', zh: '第页共页' },
    ];

    const code = `-- daily poetry / 每日诗词
-- a collection of chinese classical poetry
-- ◀/▶ to browse quotes

function _init()
 _txi()
 qi=1
 nq=100
 t=0
 music(0)
 -- stars
 sx={}
 sy={}
 sb={}
 for i=1,40 do
  sx[i]=rnd(128)
  sy[i]=rnd(128)
  sb[i]=rnd(3)
 end
 -- particles
 px={}
 py={}
 pvx={}
 pvy={}
 pc={}
 pl={}
 np=0
 fade=0
 ftgt=0
 scroll_y=0
 stgt=0
end

function spawn_particles(x,y,n,c)
 for i=1,n do
  np+=1
  if np>60 then np=1 end
  px[np]=x
  py[np]=y
  pvx[np]=rnd(2)-1
  pvy[np]=rnd(2)-1
  pc[np]=c
  pl[np]=20+rnd(20)
 end
end

function _update()
 t+=1
 -- input
 local changed=false
 if btnp(0) then
  qi-=1
  if qi<1 then qi=nq end
  changed=true
 end
 if btnp(1) then
  qi+=1
  if qi>nq then qi=1 end
  changed=true
 end
 if changed then
  fade=10
  sfx(6)
  spawn_particles(64,60,8,rnd(2)<1 and 10 or 12)
 end
 -- update stars
 for i=1,40 do
  sx[i]-=0.1+sb[i]*0.15
  if sx[i]<0 then
   sx[i]=128
   sy[i]=rnd(128)
  end
 end
 -- update particles
 for i=1,#px do
  if pl[i] and pl[i]>0 then
   px[i]+=pvx[i]
   py[i]+=pvy[i]
   pvy[i]+=0.05
   pl[i]-=1
  end
 end
 -- fade
 if fade>0 then fade-=1 end
end

function _draw()
 cls(0)
 -- gradient bg
 for i=0,15 do
  local c=0
  if i>3 then c=1 end
  if i>10 then c=2 end
  rectfill(0,i*8,127,i*8+7,c)
 end
 -- stars
 for i=1,40 do
  local b=sb[i]
  local c=1
  if b>1 then c=13 end
  if b>2 then c=6 end
  local flk=sin(t/30+i)*0.5+0.5
  if flk>0.3 then
   pset(sx[i],sy[i],c)
  end
 end
 -- decorative border
 local bc=1+flr(sin(t/60)*2+2)
 rect(3,3,124,124,bc)
 rect(4,4,123,123,bc)
 -- moon
 local mx=100+sin(t/240)*10
 local my=18+cos(t/180)*4
 circfill(mx,my,8,7)
 circfill(mx+3,my-2,7,0)
 -- mountains
 for x=0,127 do
  local h1=80+sin(x/40)*12+cos(x/25)*6
  local h2=85+sin(x/30+0.5)*10+cos(x/20)*4
  line(x,h1,x,127,1)
  line(x,h2,x,127,2)
 end
 -- title bar
 rectfill(8,8,119,20,1)
 tx("title",10,10,10)
 -- quote display
 local qk="q"..qi
 local qc=7+flr(sin(t/30)*2)
 if qc<7 then qc=7 end
 if qc>10 then qc=10 end
 -- center area bg
 rectfill(8,26,119,90,1)
 -- draw quote text
 if fade<5 then
  tx(qk,12,34,qc)
 end
 -- page indicator
 rectfill(8,96,119,108,1)
 tx("hint",12,98,13)
 print(qi.."/"..nq,100,98,6)
 -- particles
 for i=1,#px do
  if pl[i] and pl[i]>0 then
   local a=pl[i]/40
   if a>0.3 then
    pset(px[i],py[i],pc[i])
   end
  end
 end
 -- bottom decoration
 for x=6,121,4 do
  local yy=122+sin(t/20+x/16)*2
  pset(x,yy,5)
 end
end
`;

    const entries = quotes.map(q => ({
        key: q.key,
        translations: { zh: q.zh }
    }));

    // Build SFX and music data for a classical Chinese pentatonic BGM
    const sfx = new Array(4352).fill(0);
    const musicData = new Array(256).fill(0);

    // Helper: pack a note into 2 bytes at sfx[offset]
    function packNoteAt(sfxSlot: number, noteIdx: number, pitch: number, waveform: number, volume: number, effect: number) {
        const off = sfxSlot * 68 + noteIdx * 2;
        sfx[off] = (pitch & 0x3f) | ((waveform & 0x03) << 6);
        sfx[off + 1] = ((waveform >> 2) & 0x01) | ((volume & 0x07) << 1) | ((effect & 0x07) << 4);
    }
    function setSfxProps(sfxSlot: number, speed: number, loopStart: number, loopEnd: number) {
        const off = sfxSlot * 68;
        sfx[off + 65] = speed;
        sfx[off + 66] = loopStart;
        sfx[off + 67] = loopEnd;
    }

    // Pentatonic notes: C=0,D=2,E=4,G=7,A=9 (semitone offsets)
    // Octave 2 base=24, Octave 3 base=36, Octave 1 base=12

    // SFX 0: Melody (triangle, gentle pentatonic phrase) - speed 16 for slow tempo
    // A meditative 32-note melody using C D E G A pentatonic in octaves 2-3
    const melody = [
        28,31,33,36, 33,31,28,24,  // E2 G2 A2 C3  A2 G2 E2 C2
        26,28,31,33, 36,33,31,28,  // D2 E2 G2 A2  C3 A2 G2 E2
        33,36,40,43, 40,36,33,31,  // A2 C3 E3 G3  E3 C3 A2 G2
        28,26,24,28, 31,28,26,24,  // E2 D2 C2 E2  G2 E2 D2 C2
    ];
    setSfxProps(0, 20, 0, 0); // speed 20 (slow, contemplative)
    for (let i = 0; i < 32; i++) {
        packNoteAt(0, i, melody[i], 1, 4, 0); // triangle, vol 4
    }

    // SFX 1: Melody phrase 2 (variation)
    const melody2 = [
        36,40,43,45, 43,40,36,33,  // C3 E3 G3 A3  G3 E3 C3 A2
        31,33,36,40, 43,40,36,33,  // G2 A2 C3 E3  G3 E3 C3 A2
        28,31,33,28, 26,24,26,28,  // E2 G2 A2 E2  D2 C2 D2 E2
        31,28,26,24, 24,0,0,0,     // G2 E2 D2 C2  C2 rest rest rest
    ];
    setSfxProps(1, 20, 0, 0);
    for (let i = 0; i < 32; i++) {
        const p = melody2[i];
        packNoteAt(1, i, p, 1, p ? 4 : 0, p ? 0 : 0); // triangle
    }

    // SFX 2: Bass line (sawtooth, low octave) - sustained root notes
    const bass = [
        12,12,12,12, 12,12,12,12,  // C1 held
        14,14,14,14, 14,14,14,14,  // D1 held
        9,9,9,9,     9,9,9,9,      // A0 held
        12,12,12,12, 12,12,12,12,  // C1 held
    ];
    setSfxProps(2, 20, 0, 0);
    for (let i = 0; i < 32; i++) {
        packNoteAt(2, i, bass[i], 2, 3, 0); // sawtooth, vol 3
    }

    // SFX 3: Bass line 2
    const bass2 = [
        19,19,19,19, 19,19,19,19,  // G1 held
        16,16,16,16, 16,16,16,16,  // E1 held
        14,14,14,14, 14,14,14,14,  // D1 held
        12,12,12,12, 12,12,12,12,  // C1 held
    ];
    setSfxProps(3, 20, 0, 0);
    for (let i = 0; i < 32; i++) {
        packNoteAt(3, i, bass2[i], 2, 3, 0);
    }

    // SFX 4: Arpeggio/chime (sine, high octave) - sparse sparkle notes
    const arp = [
        48,0,43,0,   40,0,0,0,     // C4 . G3 . E3 . . .
        45,0,40,0,   36,0,0,0,     // A3 . E3 . C3 . . .
        48,0,45,0,   43,0,40,0,    // C4 . A3 . G3 . E3 .
        43,0,0,0,    40,0,0,0,     // G3 . . . E3 . . .
    ];
    setSfxProps(4, 20, 0, 0);
    for (let i = 0; i < 32; i++) {
        const p = arp[i];
        packNoteAt(4, i, p, 0, p ? 2 : 0, p ? 5 : 0); // sine, vol 2, effect 5 (fade)
    }

    // SFX 5: Arpeggio 2
    const arp2 = [
        40,0,0,36,   0,0,43,0,     // E3 . . C3 . . G3 .
        0,45,0,0,    40,0,0,0,     // . A3 . . E3 . . .
        48,0,0,43,   0,0,0,40,     // C4 . . G3 . . . E3
        0,0,36,0,    0,0,0,0,      // . . C3 . . . . .
    ];
    setSfxProps(5, 20, 0, 0);
    for (let i = 0; i < 32; i++) {
        const p = arp2[i];
        packNoteAt(5, i, p, 0, p ? 2 : 0, p ? 5 : 0);
    }

    // SFX 6: page-turn sound effect (short chirp)
    const chirp = [45,48,52,55, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
    setSfxProps(6, 4, 0, 0); // fast speed
    for (let i = 0; i < 32; i++) {
        const p = chirp[i];
        packNoteAt(6, i, p, 0, p ? 5 : 0, p ? 5 : 0); // sine, fade effect
    }

    // Music patterns: 2 patterns that loop
    // Pattern 0: SFX 0 (melody) + SFX 2 (bass) + SFX 4 (arp) - loop start
    musicData[0] = 0x00 | 0x80; // ch0: sfx 0, loop-start flag
    musicData[1] = 0x02;         // ch1: sfx 2
    musicData[2] = 0x04;         // ch2: sfx 4
    musicData[3] = 0x40;         // ch3: disabled

    // Pattern 1: SFX 1 (melody2) + SFX 3 (bass2) + SFX 5 (arp2) - loop end
    musicData[4] = 0x01;         // ch0: sfx 1
    musicData[5] = 0x03 | 0x80; // ch1: sfx 3, loop-end flag
    musicData[6] = 0x05;         // ch2: sfx 5
    musicData[7] = 0x40;         // ch3: disabled

    // Remaining patterns: all disabled
    for (let i = 8; i < 256; i++) {
        musicData[i] = 0x40;
    }

    const cartData: CartData = {
        code,
        gfx: new Array(8192).fill(0),
        map: new Array(4096).fill(0),
        gfxFlags: new Array(256).fill(0),
        music: musicData,
        sfx,
        label: ''
    };
    const metaData: MetaData = {
        meta: { title: 'Daily Poetry', author: 'PICO-8 IDE', template: 'default' },
        i18n: {
            locales: ['zh'],
            entries,
            outputLocale: 'zh'
        }
    };
    return cartDataToP8Mod(cartData, metaData);
}

function tryParseJson(text: string): any {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

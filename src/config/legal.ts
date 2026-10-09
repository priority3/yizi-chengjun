// The 隐私政策, 用户协议, 适龄提示 and 健康游戏忠告 as data (plan.md v0.9 合规版 item 3), shown by the launch splash
// (ui/splash-scene.ts) and the 关于 screen (ui/about-scene.ts). Written for an individual developer: every sentence
// must stay true of what the game does, so revisit these texts (and EFFECTIVE_DATE) whenever the game starts to
// store, send or ask for anything new. tests/legal.test.ts checks the fixed facts and plan.md's wording rules.
// Drawn only with the sans font: none of this text needs the brush font.
import { GAME_NAME } from './brand.ts';

/** Where players reach the developer; printed in both texts and on the 关于 screen. */
export const CONTACT_EMAIL = '1832052104@qq.com';
/** Who provides the game (plan.md: the game is published by an individual). */
export const DEVELOPER = '个人开发者';
/** When the current texts took effect. */
export const EFFECTIVE_DATE = '2026年10月9日';
/** The age rating (适龄提示): suitable from this age on. */
export const AGE_RATING = 12;
/** The rating as the 适龄提示 badge prints it. */
export const AGE_LABEL = `${AGE_RATING}+`;

/** 健康游戏忠告: the industry's standard four lines, verbatim. */
export const HEALTH_ADVICE: readonly string[] = [
  '抵制不良游戏，拒绝盗版游戏。',
  '注意自我保护，谨防受骗上当。',
  '适度游戏益脑，沉迷游戏伤身。',
  '合理安排时间，享受健康生活。',
];

/** One numbered part of a legal text. */
export interface LegalSection {
  heading: string;
  paragraphs: readonly string[];
}

/** A legal text: its title, when it took effect, the opening paragraphs, then the numbered sections. */
export interface LegalDoc {
  title: string;
  effective: string;
  intro: readonly string[];
  sections: readonly LegalSection[];
}

/** The game's name in title marks, as the texts cite it. */
const GAME = `《${GAME_NAME}》`;

/**
 * 适龄提示, in the usual order: the age range, the genre and themes, what the game contains and lacks, a word to
 * parents.
 */
export const AGE_NOTICE: readonly string[] = [
  `本游戏适合 ${AGE_RATING} 周岁及以上的用户（适龄提示 ${AGE_LABEL}），建议未成年人在监护人的指导下游戏。`,
  '本游戏是一款单机汉字合成塔防游戏，以汉字字卡和古典小说人物为题材，画面为卡通风格；游戏中有卡通风格的对战画面，没有血腥和低俗内容。',
  '游戏需要一定的策略思考和汉字认读能力。游戏没有账号、聊天、组队等社交功能，也没有任何付费内容。',
  '请家长关注孩子的游戏时间，帮助孩子合理安排学习、休息和娱乐。',
];

/** 隐私政策. Reason: the game collects nothing, so the policy says exactly that and where the data it keeps lives. */
export const PRIVACY_POLICY: LegalDoc = {
  title: `${GAME}隐私政策`,
  effective: EFFECTIVE_DATE,
  intro: [
    `${GAME}（以下简称「本游戏」）是由${DEVELOPER}（以下简称「开发者」）独立开发、免费提供的单机游戏。本政策说明本游戏如何对待与你有关的信息，请你在使用本游戏之前仔细阅读。`,
  ],
  sections: [
    {
      heading: '一、不收集个人信息',
      paragraphs: [
        '本游戏不收集、不使用、不保存，也不向任何人提供你的个人信息。玩本游戏不需要注册或登录，也不需要填写任何资料。',
        '本游戏不申请任何设备权限，不读取你的位置、通讯录、相册、相机、麦克风、设备标识等信息。',
      ],
    },
    {
      heading: '二、网络通信',
      paragraphs: [
        '除了下载游戏本身的文件，本游戏不进行任何网络通信：不上传任何数据，不调用任何服务器接口，也不从第三方加载字体、图片或脚本。',
        '网页版的游戏文件从网站的托管服务器下载。为了能离线游玩，浏览器会把游戏文件缓存在本机，并在你打开或回到游戏时，向同一网站检查有没有新版本。和访问任何网站一样，托管服务器可能按惯例记录访问日志（如访问时间、IP 地址、请求的文件和浏览器类型），这些日志由托管服务商按其规则保存，开发者不会用它们识别你的身份。',
        '在小游戏平台上游玩时，游戏包由平台下发和更新。你使用平台时，适用该平台自己的用户协议和隐私政策。',
      ],
    },
    {
      heading: '三、只保存在本机的数据',
      paragraphs: [
        '你的游戏进度（解锁的章节、星级、灵石、法宝，无尽模式和每日挑战的记录，新手引导是否完成等）、声音设置、没打完的那一局的存档，以及网页版地图编辑器的草稿，都只保存在这台设备的本地存储里（浏览器的网站数据，或小游戏平台提供的本地缓存），不会上传。',
        '清除浏览器的网站数据、清理小游戏的缓存，或者删除小游戏，都会删除这些数据，删除后无法恢复。',
        '网页版地图编辑器的「导出」会把地图文字复制到剪贴板，由你自己决定粘贴到哪里；本游戏不读取剪贴板。',
      ],
    },
    {
      heading: '四、第三方',
      paragraphs: ['本游戏没有接入任何第三方 SDK，不使用任何第三方统计、分析、广告或追踪工具。'],
    },
    {
      heading: '五、分享战报',
      paragraphs: [
        '结算面板上的「分享」会在你的设备上画出一张战报图片，交给系统的分享面板，或者直接显示出来供你保存。本游戏不会上传这张图片；你在分享面板里选择的应用会收到它，并按该应用自己的规则处理。',
      ],
    },
    {
      heading: '六、未成年人',
      paragraphs: [
        `本游戏适合 ${AGE_RATING} 周岁及以上的用户（适龄提示 ${AGE_LABEL}）。本游戏不收集任何人的个人信息，包括未成年人的个人信息。未成年人请在监护人的指导下使用本游戏，合理安排游戏时间。`,
      ],
    },
    {
      heading: '七、本政策的更新',
      paragraphs: [
        '开发者可能会随着游戏的变化更新本政策，更新后的版本会发布在游戏的「关于」页面，并写明新的生效日期。如果以后的版本需要收集任何个人信息，开发者会先更新本政策，并在收集之前明确告知你、征得你的同意。',
      ],
    },
    {
      heading: '八、联系开发者',
      paragraphs: [`如果你对本政策有任何疑问、意见或建议，请发邮件到 ${CONTACT_EMAIL}，开发者会尽快回复。`],
    },
  ],
};

/** 用户协议: short and plain, for a free single-player game by an individual developer. */
export const USER_AGREEMENT: LegalDoc = {
  title: `${GAME}用户协议`,
  effective: EFFECTIVE_DATE,
  intro: [
    `欢迎使用${GAME}（以下简称「本游戏」）。本协议是你与本游戏的开发者（${DEVELOPER}，以下简称「开发者」）之间关于使用本游戏的约定。请在使用本游戏之前仔细阅读本协议；你开始使用本游戏，即表示同意本协议。未成年人请在监护人的陪同下阅读。`,
  ],
  sections: [
    {
      heading: '一、服务内容',
      paragraphs: [
        '本游戏是由个人开发者独立开发、免费提供的单机汉字合成塔防游戏。本游戏目前不含任何付费内容和广告，也没有账号、聊天等社交功能。',
      ],
    },
    {
      heading: '二、使用许可',
      paragraphs: [
        '开发者授予你一项个人的、非独占的、不可转让的、可撤销的许可，你可以为个人娱乐目的使用本游戏。本协议没有明确授予你的权利，均由开发者保留。',
      ],
    },
    {
      heading: '三、使用规范',
      paragraphs: [
        '使用本游戏时，请遵守法律法规，并且不要：',
        '1. 破解、篡改本游戏，或者制作、传播、使用外挂等作弊工具；',
        '2. 未经开发者书面许可，出于商业目的复制、转载、镜像、出售或以其他方式再分发本游戏，包括把本游戏放进收费或带广告的合集；',
        '3. 利用本游戏从事违法活动，或者侵害他人的合法权益。',
      ],
    },
    {
      heading: '四、知识产权',
      paragraphs: [
        '本游戏的程序代码、画面、音效、音乐、文字和关卡设计，其著作权及其他知识产权归开发者所有。游戏画面全部由程序绘制，音效和音乐全部由程序实时合成。',
        '游戏中的书法字体是马善政楷书（Ma Shan Zheng），版权归 The Ma Shan Zheng Project Authors 所有，按 SIL 开源字体许可证 1.1 版（SIL Open Font License 1.1）使用。',
        '欢迎你出于非商业目的分享游戏截图、录屏和战报图片。',
      ],
    },
    {
      heading: '五、未成年人保护',
      paragraphs: [
        `本游戏的适龄提示为 ${AGE_LABEL}，适合 ${AGE_RATING} 周岁及以上的用户。未成年人应在监护人的指导下使用本游戏。`,
        `请牢记健康游戏忠告：${HEALTH_ADVICE.join('')}`,
        '本游戏不设账号，没有付费和社交功能。建议监护人借助设备或平台提供的未成年人模式、屏幕使用时间等功能，帮助孩子控制游戏时间。',
      ],
    },
    {
      heading: '六、数据保存',
      paragraphs: [
        '本游戏的进度和设置只保存在你的设备上，开发者没有服务器备份。清除浏览器的网站数据、清理小游戏缓存或者删除小游戏，都会使进度丢失且无法恢复；换一台设备，进度也不会跟着过去。',
      ],
    },
    {
      heading: '七、免责声明',
      paragraphs: [
        '本游戏按现状提供。开发者会尽力让游戏稳定运行，但不保证游戏没有错误、不会中断，也不保证游戏适合你的所有设备。',
        '在法律允许的范围内，对于设备故障、系统或浏览器设置、清除数据、网络或第三方平台等原因造成的进度丢失或其他损失，开发者不承担责任。',
      ],
    },
    {
      heading: '八、服务变更',
      paragraphs: ['开发者可以根据需要更新游戏内容，也可以暂停或停止提供本游戏的部分或全部版本。'],
    },
    {
      heading: '九、协议的修改',
      paragraphs: [
        '开发者可能修改本协议，修改后的协议会发布在游戏的「关于」页面，并写明新的生效日期。修改后你继续使用本游戏，即表示接受修改后的协议；如果不同意，请停止使用本游戏。',
      ],
    },
    {
      heading: '十、法律适用与争议解决',
      paragraphs: [
        '本协议适用中华人民共和国法律。因本协议产生的争议，双方应友好协商解决；协商不成的，任何一方都可以向有管辖权的人民法院提起诉讼。',
      ],
    },
    {
      heading: '十一、联系方式',
      paragraphs: [`对本协议有任何疑问，或者想反馈问题，请发邮件到 ${CONTACT_EMAIL}。`],
    },
  ],
};

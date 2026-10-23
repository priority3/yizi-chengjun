// The English Privacy Policy and Terms of Use, shown on the About screen while the game is in English (i18n/lang.ts).
// They say what the Chinese 隐私政策 and 用户协议 (legal.ts) say, without what only games in China carry (the 12+
// 适龄提示 and the 健康游戏忠告), and with a word on game portals, where the English build is played. Every sentence
// must stay true of what the game does: revisit these together with legal.ts whenever the game starts to store, send
// or ask for anything new. Drawn only with the sans font, like legal.ts.
import { GAME_NAME_EN } from './brand.ts';
import { CONTACT_EMAIL, type LegalDoc } from './legal.ts';

/** When the English texts took effect. */
export const EFFECTIVE_DATE_EN = 'October 23, 2026';
/** Who provides the game, as the About screen's contact section names them. */
export const DEVELOPER_EN = 'Individual developer';

/** Privacy Policy: the game collects nothing, so the policy says exactly that and where the data it keeps lives. */
export const PRIVACY_POLICY_EN: LegalDoc = {
  title: `${GAME_NAME_EN} Privacy Policy`,
  effective: EFFECTIVE_DATE_EN,
  intro: [
    `${GAME_NAME_EN} ("the Game") is a free single-player game made and provided by an individual developer ("the Developer"). This policy explains how the Game treats information about you. Please read it before you play.`,
  ],
  sections: [
    {
      heading: '1. No personal information',
      paragraphs: [
        "The Game does not collect, use, store or share any personal information about you. You don't need to sign up, log in or fill in anything to play.",
        'The Game asks for no device permissions and does not read your location, contacts, photos, camera, microphone, device identifiers or similar information.',
      ],
    },
    {
      heading: '2. Network',
      paragraphs: [
        'Apart from downloading its own files, the Game makes no network connections: it uploads no data, calls no server and loads no fonts, images or scripts from third parties.',
        "The web version's files are downloaded from the website's hosting server. So that you can play offline, your browser keeps them in a local cache and, when you open or return to the Game, checks the same website for a new version. As with any website, the hosting server may keep routine access logs (such as the time, IP address, files requested and browser type). The hosting provider keeps these logs under its own rules, and the Developer does not use them to identify you.",
        'When you play on a game portal or another platform, that platform delivers and updates the Game, and its own terms and privacy policy apply to your use of it.',
      ],
    },
    {
      heading: '3. Data kept only on your device',
      paragraphs: [
        "Your progress (unlocked chapters, stars, Spirit Stones, relics, endless and daily records, whether you finished the tutorial and so on), your sound and language settings, the save of an unfinished run and the web version's map editor drafts are kept only in this device's local storage (the browser's site data, or the local storage a platform provides). They are never uploaded.",
        "Clearing the browser's site data or the platform's cache, or removing the Game, deletes this data, and it cannot be recovered.",
        "The web version's map editor copies map text to your clipboard when you choose Export, and you decide where to paste it; the Game never reads the clipboard.",
      ],
    },
    {
      heading: '4. Third parties',
      paragraphs: ['The Game includes no third-party SDKs and uses no third-party analytics, advertising or tracking tools.'],
    },
    {
      heading: '5. Sharing results',
      paragraphs: [
        "Share on a results panel draws a results picture on your device and hands it to your system's share sheet, or shows it for you to save. The Game does not upload this picture; an app you choose in the share sheet receives it and handles it under its own rules.",
      ],
    },
    {
      heading: '6. Children',
      paragraphs: [
        "The Game collects no personal information from anyone, including children. Children should play with a parent's or guardian's guidance and keep their playing time reasonable.",
      ],
    },
    {
      heading: '7. Changes to this policy',
      paragraphs: [
        "The Developer may update this policy as the Game changes. The updated policy will appear on the Game's About screen with its new effective date. If a future version needs to collect any personal information, the Developer will update this policy first, and tell you clearly and ask for your consent before collecting it.",
      ],
    },
    {
      heading: '8. Contact',
      paragraphs: [`If you have any questions, comments or suggestions about this policy, email ${CONTACT_EMAIL} and the Developer will reply as soon as possible.`],
    },
  ],
};

/** Terms of Use: short and plain, for a free single-player game by an individual developer. */
export const TERMS_EN: LegalDoc = {
  title: `${GAME_NAME_EN} Terms of Use`,
  effective: EFFECTIVE_DATE_EN,
  intro: [
    `Welcome to ${GAME_NAME_EN} ("the Game"). These terms are an agreement between you and the Game's developer (an individual developer, "the Developer") about using the Game. Please read them before you use the Game; by starting to use it, you agree to them. Children should read them with a parent or guardian.`,
  ],
  sections: [
    {
      heading: '1. The Game',
      paragraphs: [
        'The Game is a free single-player tower defense game about merging Chinese glyphs, made and provided by an individual developer. It has no paid content or ads, and no accounts, chat or other social features.',
      ],
    },
    {
      heading: '2. License',
      paragraphs: [
        'The Developer grants you a personal, non-exclusive, non-transferable and revocable license to use the Game for your own entertainment. All rights these terms do not expressly grant you are reserved by the Developer.',
      ],
    },
    {
      heading: '3. Acceptable use',
      paragraphs: [
        'When using the Game, please follow the law, and do not:',
        '1. crack or modify the Game, or make, share or use cheats or other cheating tools;',
        "2. copy, repost, mirror, sell or otherwise redistribute the Game for commercial purposes without the Developer's written permission, including putting it into a paid or ad-supported collection;",
        "3. use the Game for anything illegal or to infringe anyone's rights.",
      ],
    },
    {
      heading: '4. Intellectual property',
      paragraphs: [
        "The copyright and other intellectual property rights in the Game's code, graphics, sound effects, music, text and level design belong to the Developer. All of the Game's graphics are drawn by code, and all of its sound effects and music are synthesized live by code.",
        "The Game's calligraphy font is Ma Shan Zheng, copyright The Ma Shan Zheng Project Authors, used under the SIL Open Font License 1.1.",
        'You are welcome to share screenshots, recordings and result pictures of the Game for non-commercial purposes.',
      ],
    },
    {
      heading: '5. Children',
      paragraphs: [
        "Children should use the Game under a parent's or guardian's guidance. The Game has no accounts, payments or social features. Parents and guardians can use the parental controls and screen-time features of their device or platform to help children manage their playing time.",
      ],
    },
    {
      heading: '6. Your data',
      paragraphs: [
        "The Game's progress and settings are kept only on your device; the Developer has no server backup. Clearing the browser's site data or the platform's cache, or removing the Game, loses your progress for good, and your progress does not move with you to another device.",
      ],
    },
    {
      heading: '7. Disclaimer',
      paragraphs: [
        'The Game is provided "as is". The Developer tries to keep it running well, but does not promise that it is free of errors or interruptions, or that it suits every device you use.',
        'To the extent the law allows, the Developer is not liable for lost progress or other losses caused by device failures, system or browser settings, cleared data, the network, third-party platforms or similar causes.',
      ],
    },
    {
      heading: '8. Changes to the Game',
      paragraphs: ["The Developer may update the Game's content, and may pause or stop offering some or all versions of the Game."],
    },
    {
      heading: '9. Changes to these terms',
      paragraphs: [
        "The Developer may change these terms. The changed terms will appear on the Game's About screen with their new effective date. If you keep using the Game after a change, you accept the changed terms; if you don't agree, please stop using the Game.",
      ],
    },
    {
      heading: '10. Governing law and disputes',
      paragraphs: [
        "These terms are governed by the laws of the People's Republic of China. Any dispute arising from them should first be settled through friendly negotiation; if that fails, either party may bring a lawsuit before a people's court with jurisdiction.",
      ],
    },
    {
      heading: '11. Contact',
      paragraphs: [`If you have any questions about these terms or want to report a problem, email ${CONTACT_EMAIL}.`],
    },
  ],
};

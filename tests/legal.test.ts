// The 隐私政策, 用户协议, 适龄提示 and 健康游戏忠告 (src/config/legal.ts): the facts they must state, the advice verbatim,
// and plan.md's wording rules (no religious or violent words) for every line of them.
import { describe, expect, it } from 'vitest';
import { GAME_NAME } from '../src/config/brand.ts';
import {
  AGE_LABEL,
  AGE_NOTICE,
  AGE_RATING,
  CONTACT_EMAIL,
  EFFECTIVE_DATE,
  HEALTH_ADVICE,
  PRIVACY_POLICY,
  USER_AGREEMENT,
  type LegalDoc,
} from '../src/config/legal.ts';
import { forbiddenIn } from './wording.ts';

/** Every line of a text, title to last paragraph. */
const docText = (d: LegalDoc): string => [d.title, d.effective, ...d.intro, ...d.sections.flatMap((s) => [s.heading, ...s.paragraphs])].join('\n');

const PRIVACY = docText(PRIVACY_POLICY);
const AGREEMENT = docText(USER_AGREEMENT);
/** The numerals the sections are numbered with, in order. */
const NUMBERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

describe('legal texts', () => {
  it('give the 健康游戏忠告 verbatim, and the user agreement quotes it in full', () => {
    expect(HEALTH_ADVICE).toEqual(['抵制不良游戏，拒绝盗版游戏。', '注意自我保护，谨防受骗上当。', '适度游戏益脑，沉迷游戏伤身。', '合理安排时间，享受健康生活。']);
    expect(AGREEMENT).toContain(HEALTH_ADVICE.join(''));
  });

  it('name the game, the effective date, the contact email and the 12+ rating', () => {
    expect([CONTACT_EMAIL, EFFECTIVE_DATE, AGE_RATING, AGE_LABEL]).toEqual(['1832052104@qq.com', '2026年10月9日', 12, '12+']);
    for (const [d, name] of [
      [PRIVACY_POLICY, '隐私政策'],
      [USER_AGREEMENT, '用户协议'],
    ] as const) {
      expect(d.title).toBe(`《${GAME_NAME}》${name}`);
      expect(d.effective).toBe('2026年10月9日');
      const t = docText(d);
      expect(t).toContain('1832052104@qq.com');
      expect(t).toContain('12+');
      expect(t).toContain('个人开发者');
    }
    expect(AGE_NOTICE.join('')).toContain('12+');
  });

  it('number their sections in order, each with something to say', () => {
    for (const d of [PRIVACY_POLICY, USER_AGREEMENT]) {
      expect(d.intro.length).toBeGreaterThan(0);
      d.sections.forEach((s, i) => {
        expect(s.heading.startsWith(`${NUMBERS[i]}、`), s.heading).toBe(true);
        expect(s.paragraphs.length).toBeGreaterThan(0);
        for (const p of s.paragraphs) expect(p.trim().length).toBeGreaterThan(0);
      });
    }
  });

  it('state in the privacy policy what the game does and does not do', () => {
    for (const fact of [
      '不收集、不使用、不保存，也不向任何人提供你的个人信息',
      '不申请任何设备权限',
      '除了下载游戏本身的文件，本游戏不进行任何网络通信',
      '托管服务器可能按惯例记录访问日志',
      '游戏包由平台下发',
      '只保存在这台设备的本地存储里',
      '没打完的那一局的存档',
      '地图编辑器的草稿',
      '清除浏览器的网站数据、清理小游戏的缓存，或者删除小游戏，都会删除这些数据',
      '没有接入任何第三方 SDK',
      '统计、分析、广告或追踪工具',
      '本游戏不会上传这张图片',
      '包括未成年人的个人信息',
      '更新本政策',
    ]) {
      expect(PRIVACY, fact).toContain(fact);
    }
  });

  it('cover in the user agreement what the brief lists', () => {
    for (const fact of [
      '个人开发者独立开发、免费提供的单机',
      '许可',
      '外挂',
      '再分发',
      '知识产权',
      '马善政楷书',
      'SIL Open Font License 1.1',
      '未成年人',
      '健康游戏忠告',
      '无法恢复',
      '免责',
      '暂停或停止提供',
      '修改本协议',
      '中华人民共和国法律',
    ]) {
      expect(AGREEMENT, fact).toContain(fact);
    }
  });

  it('keep every line free of religious and violent wording', () => {
    expect(forbiddenIn([PRIVACY, AGREEMENT, ...AGE_NOTICE, ...HEALTH_ADVICE].join('\n'))).toEqual([]);
  });
});

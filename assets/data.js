/* ==========================================================
   数据层 —— 改数值只改这里，不要动 game.js
   ========================================================== */

/* 书籍品质六档 —— name 用书籍自己的脉络（手抄本→原典），
   grade 是通用品阶（普通→史诗），只在装备等「非书」场合使用。
   两套并存：书讲出身，装备讲强度。 */
const QUALITIES = [
  { name:'手抄本', grade:'普通', mark:'普', color:'#9aa0a6', rate:1.0, skill:1.0, cap:20,  pageCost:0 },
  { name:'刊印本', grade:'精英', mark:'精', color:'#5da86b', rate:1.5, skill:1.4, cap:40,  pageCost:420 },
  { name:'精校本', grade:'优秀', mark:'优', color:'#4f93c7', rate:2.2, skill:1.9, cap:60,  pageCost:2800 },
  { name:'批注本', grade:'稀有', mark:'稀', color:'#9370db', rate:3.2, skill:2.6, cap:80,  pageCost:12000 },
  { name:'孤本',   grade:'传奇', mark:'传', color:'#d98b3a', rate:4.5, skill:3.5, cap:100, pageCost:48000 },
  { name:'原典',   grade:'史诗', mark:'史', color:'#d0453a', rate:6.0, skill:4.6, cap:120, pageCost:160000 },
];

/* 学科标签：决定相性克制 */
/* 方法论克制环：A 克 B 当 COUNTER[A] === B。六环闭合，每个只克一个、只被一个克 */
const COUNTER = {
  '实证':'诠释', '诠释':'演绎', '演绎':'归纳',
  '归纳':'先验', '先验':'计算', '计算':'实证',
};
const DOCTRINES = ['实证', '诠释', '演绎', '归纳', '先验', '计算'];

/* 方法论的自我介绍，图鉴里用 */
const DOCTRINE_DESC = {
  '实证':'以观察与实验为唯一准绳。它克诠释：数据能终结一切过度解读。',
  '诠释':'追问意义先于追问形式。它克演绎：结构再严密，也回答不了"这意味着什么"。',
  '演绎':'从少数公理推出整个体系。它克归纳：一万个例子不如一条证明。',
  '归纳':'从个别事例概括一般规律。它克先验：经验能反驳一切天赋观念。',
  '先验':'主张存在先于经验的认知结构。它克计算：机器算得出的，未必是能理解的。',
  '计算':'凡可机械执行者即为真。它克实证：模拟能跑出实验永远做不到的东西。',
};

/* ============================================================
   人物怪癖（QUIRK）
   ------------------------------------------------------------
   精英与 BOSS 不靠「血更厚、攻更高」来变难，而是带着自己那一段生平的规则上场。
   挂点分三类：
     tick  每秒结算一次（自损、递增、攒护盾）
     hit   每次被命中时结算（暴露破绽、天平）
     cast  与玩家施法相关（延冷却、破盾沉默）
   数值都在这里，方便单独调，不用翻战斗代码。
   ============================================================ */
const QUIRKS = {
  bubble: {
    name:'南海泡沫', icon:'💸',
    desc:'他把自己炒进了泡沫里 —— 每 8 秒自损 4% 最大生命，亏掉的部分折算成你的洞见。',
    tip:'拖住他，他会自己亏死。',
    every:8, selfLoss:0.04, insightShare:0.35,
  },
  ether: {
    name:'以太护盾', icon:'🫧',
    desc:'他相信存在一种看不见的介质 —— 每 11 秒获得一层护盾，免疫下一次伤害；破盾时你被沉默 2 秒。',
    tip:'小额多段伤害更容易破盾。',
    every:11, silence:2,
  },
  dogma: {
    name:'教条', icon:'📕',
    desc:'他只承认自己那一套 —— 你与他同学科的书，伤害 -40%。',
    tip:'换一个学科上场。',
    penalty:0.40,
  },
  falsify: {
    name:'可证伪', icon:'🔍',
    desc:'每挨 5 次命中就被逼出一次破绽 —— 暴露 4 秒，期间受到伤害 +60%。',
    tip:'堆攻速，让破绽反复出现。',
    hits:5, dur:4, amp:0.60,
  },
  compound: {
    name:'复利', icon:'📈',
    desc:'他的攻击每 9 秒上涨 12%，没有上限。',
    tip:'这场不能拖。',
    every:9, growth:0.12,
  },
  overdue: {
    name:'同行评议', icon:'📝',
    desc:'每 14 秒把你一个技能的冷却往后推 3 秒。',
    tip:'CD 短的书损失更小。',
    every:14, push:3,
  },
  entropy: {
    name:'熵增', icon:'♨️',
    desc:'无序只会增加 —— 每 10 秒，双方受到的伤害都 +12%（可叠加）。',
    tip:'速战速决，或者带减伤。',
    every:10, growth:0.12,
  },
  leap: {
    name:'跃迁', icon:'⚛️',
    desc:'每损失 25% 生命就瞬移一次，同时重置你全部技能冷却。',
    tip:'爆发留在他瞬移之后。',
    step:0.25,
  },
  balance: {
    name:'天平', icon:'⚖️',
    desc:'他每被命中一次就称一次重 —— 自身减伤 +6%（可叠加），但攻击 -4%。',
    tip:'越打越硬，也越打越软：先熬，再爆发。',
    defStep:0.06, atkStep:0.04, defCap:0.55,
  },

  /* ---- 以下专供精英：机制本身是通用的，但每个精英的文案写他自己 ---- */
  thorns: {
    name:'弹性', icon:'🪀',
    desc:'他把每一次打击都存成弹性势能，再原样还给你。',
    tip:'别用高频小伤害喂他。',
    back:0.30,
  },
  dilute: {
    name:'稀释', icon:'💧',
    desc:'再大的力落到他身上都会被摊平 —— 单次伤害有上限。',
    tip:'爆发打不穿，改成持续输出。',
    cap:0.075,          /* 单次伤害不超过最大生命的 7.5% */
  },
  spike: {
    name:'脉冲', icon:'⚡',
    desc:'他每隔一段时间蓄满一次，然后一次放出。',
    tip:'看到蓄力就提前上减伤。',
    every:12, mult:2.4,
  },
  shrug: {
    name:'涨落', icon:'🎲',
    desc:'他的状态本来就不确定 —— 每次受击有概率整击落空。',
    tip:'多打几次，总会穿过去。',
    chance:0.22,
  },
  drain: {
    name:'汲取', icon:'🩸',
    desc:'他造成的伤害，有一部分会变成他自己的生命。',
    tip:'减伤比输出更划算。',
    rate:0.30,
  },
  blind: {
    name:'蔽障', icon:'🌫️',
    desc:'他让你看不清真正的要害 —— 你的暴击对他无效。',
    tip:'暴击流在这里失效，换纯攻。',
  },
  decay: {
    name:'归类', icon:'🗂️',
    desc:'他把你用过的东西编了号：同一本书连续使用，伤害每次递减 12%。',
    tip:'轮换着用，别只靠一本。',
    step:0.12, max:0.60,
  },
  ramp: {
    name:'爬升', icon:'📶',
    desc:'他每 6 秒加快一档，永远不会停。',
    tip:'速战。',
    every:6, growth:0.08,
  },
};

const TAGS = {
  motion:'运动', force:'力', field:'场', logic:'逻辑', life:'生物',
  philosophy:'哲学', theology:'宗教', finance:'金融',
};

/* ----------------------------------------------------------
   12 本书
   type: skill 技能书 / attr 属性书
   rate: 基础洞见/秒（放在书架上就生效，不必上桌）
   属性：insight 悟性 / rigor 严谨 / intuition 直觉 / eloquence 雄辩
   ---------------------------------------------------------- */
const BOOKS = [
  {
    id:'wuming', name:'无名册', emoji:'📓', type:'attr', q:0, rate:0.25,
    attr:{insight:1},
    desc:'你醒来时唯一的东西。第一页写着"你什么都不知道"。',
    quote:'"你什么都不知道。所以你可以知道一切。"',
    source:'初始',
  },
  {
    id:'luoti', name:'落体定律', emoji:'🍎', type:'skill', q:0, rate:0.18,
    tag:'motion', cd:5, mult:2.0, effect:'strike',
    desc:'他让两个铁球同时落下，从此重量不再是速度的理由。单体高伤，无视闪避。',
    quote:'"可是它仍在动。"——伽利略',
    source:'初始 · 书架上本来就有',
  },
  {
    id:'guanxing', name:'惯性定律', emoji:'⏳', type:'skill', q:0, rate:0.18,
    tag:'force', cd:9, mult:0, effect:'guard',
    desc:'没有外力，它就永远这样下去。5 秒内受到伤害减少 60%。',
    quote:'"物体保持其原有状态，除非……"',
    source:'第 1 轮 · 第 5 关首通',
  },
  {
    id:'liangmen', name:'两门新科学', emoji:'🔭', type:'attr', q:0, rate:0.30,
    attr:{intuition:3, precision:3, insight:2, rigor:3, fortitude:1},
    desc:'伽利略晚年的对话录。他把"实验"变成了可以传授的东西。',
    quote:'"测量一切可测量的，使不可测量的变为可测量。"',
    source:'第 1 轮 · 精英掉落',
  },
  {
    id:'yuanzhui', name:'圆锥曲线论', emoji:'🪐', type:'attr', q:0, rate:0.30,
    attr:{rigor:5, fortitude:1, eloquence:3, celerity:1},
    desc:'行星的轨道是一条椭圆。这句话改写了天的形状。',
    quote:'"我只在计算上帝画下的那条线。"——开普勒',
    source:'第 2 轮 · 精英掉落',
  },
  {
    id:'fanzuoyong', name:'作用与反作用', emoji:'⚖️', type:'skill', q:0, rate:0.22,
    tag:'force', cd:7, mult:1.4, effect:'reflect',
    desc:'你推它多重，它就推你多重。3 秒内反弹 45% 所受伤害。',
    quote:'"每一个作用，都有一个相等的反作用。"',
    source:'第 2 轮 · 精英掉落',
  },
  {
    id:'fangfalun', name:'方法论', emoji:'🧭', type:'attr', q:0, rate:0.35,
    attr:{rigor:6, fortitude:1, eloquence:5, celerity:1},
    desc:'把怀疑本身变成一种方法。你开始知道"怎样才算知道"。',
    quote:'"我思故我在。"——笛卡尔',
    source:'第 3 轮 · 精英掉落',
  },
  {
    id:'wanyou', name:'万有引力', emoji:'🌍', type:'skill', q:0, rate:0.30,
    tag:'force', cd:8, mult:3.2, effect:'execute',
    desc:'苹果与月亮受同一个理由支配。对生命低于 35% 的敌人伤害翻倍。',
    quote:'"如果说我看得更远，那是因为我站在巨人的肩上。"',
    source:'第 1 轮 · 牛顿首杀',
  },
  {
    id:'yuanli', name:'自然哲学的数学原理', emoji:'📕', type:'attr', q:0, rate:0.60,
    attr:{insight:5, rigor:8, fortitude:2, intuition:3, precision:2, eloquence:6, celerity:2},
    desc:'人类第一次用几条公理，把整个天与地算清楚。',
    quote:'"我不作假说。"（Hypotheses non fingo）',
    source:'第 1 轮 · 牛顿首杀',
  },
  {
    id:'mojing', name:'墨经', emoji:'🏹', type:'attr', q:0, rate:0.40,
    attr:{eloquence:8, celerity:2, rigor:3, fortitude:1},
    desc:'小孔成像、杠杆、光学八条。它出现在这个学派的书架上，本身就是一个谜。',
    quote:'"力，形之所以奋也。"',
    source:'任意关卡 · 极低概率',
  },
  {
    id:'dianci', name:'电磁感应原理', emoji:'⚡', type:'skill', q:0, rate:0.35,
    tag:'field', cd:6, mult:1.1, effect:'chain',
    desc:'变化的磁场生出电流。你在牛顿的手稿夹页里发现了它，笔迹属于一个还没出生的人。',
    quote:'"没有什么是有用的，但你可以问问它将来能变成什么。"——法拉第',
    source:'第 3 轮 · 牛顿首杀（隐藏）',
  },
  {
    id:'jixian', name:'极限逼近', emoji:'∫', type:'skill', q:0, rate:0.35,
    tag:'logic', cd:12, mult:1.2, effect:'dot',
    desc:'无限地靠近，却永远不到达——但伤害会一直叠加。每次施放叠加一层，不可驱散。',
    quote:'"给我一个支点，我可以撬动整个无穷。"',
    source:'仅可合成',
  },
  /* 合成独有 · 彩蛋 */
  {
    id:'tongyi', name:'统一场论残页', emoji:'🌌', type:'skill', q:1, rate:0.5,
    tag:'field', cd:14, mult:3.6, effect:'aoe',
    desc:'一页没有署名的草稿，写着把引力与电磁写成同一件事的尝试。对全场敌人造成伤害并沉默 3 秒。',
    quote:'"我快看见了。"',
    source:'仅可合成',
  },
  {
    id:'shougao', name:'手稿·批注本', emoji:'✒️', type:'attr', q:1, rate:0.9,
    attr:{insight:8, rigor:10, fortitude:2, intuition:4, precision:4, eloquence:8, celerity:2},
    desc:'《原理》与《两门新科学》并排摊开，页边写满了两种笔迹的争辩。',
    quote:'"我不同意你，但我用你的方法反驳你。"',
    source:'仅可合成',
  },
  {
    id:'mugou', name:'母猪的产后护理', emoji:'🐖', type:'skill', q:0, rate:0.2,
    tag:'life', cd:10, mult:0.5, effect:'summon', unit:'swarm', unitCount:2,
    desc:'一本完全不该出现在这里的书。你翻开的瞬间，理念界深处传来一阵猪叫。召唤猪群冲撞敌人 12 秒。',
    quote:'"老师，这本书是生物系的。"',
    source:'合成失败时的极小概率产物',
  },
  /* ---------- 电气学派（第二学派）---------- */
  {
    id:'jiaoliu', name:'交流电', emoji:'⚡', type:'skill', q:0, rate:0.32, school:'electric',
    tag:'field', cd:6, mult:0.32, effect:'burst',
    desc:'电流每秒改变五十次方向。连续 5 段放电，总量不高，但每一次都算数。',
    quote:'"直流是给爱迪生的，交流是给世界的。"',
    source:'第 2 学派 · 第 1 轮精英（法拉第）',
  },
  {
    id:'xianquan', name:'特斯拉线圈', emoji:'🗼', type:'skill', q:0, rate:0.40, school:'electric',
    tag:'field', cd:12, mult:2.6, effect:'aoe',
    desc:'他把整座实验室点亮，然后让空气自己导电。全场伤害并沉默 3 秒。',
    quote:'"我不是在设计机器，我是在设计一种振动。"',
    source:'第 2 学派 · 特斯拉首杀',
  },
  {
    id:'luolunzi', name:'洛伦兹力', emoji:'🧭', type:'skill', q:0, rate:0.40, school:'electric',
    tag:'force', cd:9, mult:2.8, effect:'execute',
    desc:'运动电荷在磁场里必受一力，方向永远垂直于速度。对生命低于 35% 的敌人伤害翻倍。',
    quote:'"F = qv × B"——简洁到近乎无礼。',
    source:'第 2 学派 · 第 3 轮 Boss',
  },
  {
    id:'dianxue', name:'电学实验研究', emoji:'🔬', type:'attr', q:0, rate:0.45, school:'electric',
    attr:{intuition:4, precision:4, rigor:4, fortitude:1},
    desc:'法拉第没有受过数学训练，他把每一个实验写成了编号。十年后，麦克斯韦把它们翻译成了方程。',
    quote:'"只要一个实验能说明问题，我就再做一遍。"',
    source:'第 2 学派 · 特斯拉首杀',
  },
  {
    id:'diancitonglun', name:'电磁通论', emoji:'📘', type:'attr', q:0, rate:0.75, school:'electric',
    attr:{insight:6, rigor:7, fortitude:2, intuition:3, precision:3, eloquence:7, celerity:2},
    desc:'八个方程（后来被赫维赛德删成四个），把电、磁、光写成了同一件事。',
    quote:'"光，就是电磁场的一种扰动。"',
    source:'第 2 学派 · 第 3 轮精英（赫兹）',
  },
  {
    id:'lundianci', name:'论电与磁', emoji:'🧲', type:'attr', q:0, rate:0.42, school:'electric',
    attr:{eloquence:8, celerity:2, insight:4},
    desc:'在成为实验物理学家之前，法拉第是个装订学徒。他把每一本经手的书都读完了。',
    quote:'"我什么都没有，除了一点点好奇心。"',
    source:'第 2 学派 · 稀有掉落',
  },

  /* ---------- 形式学派（第三学派）---------- */
  {
    id:'jishu', name:'级数展开', emoji:'∑', type:'skill', q:0, rate:0.34, school:'formal',
    tag:'logic', cd:7, mult:0.30, effect:'burst',
    desc:'把任何一个函数拆成无穷多项相加。每一项都很小，但它们不会停。连续 5 段。',
    quote:'"e^{iπ} + 1 = 0"——欧拉把它称作最美的式子。',
    source:'第 3 学派 · 第 1 轮精英（欧拉）',
  },
  {
    id:'digongshe', name:'第五公设', emoji:'📐', type:'skill', q:0, rate:0.42, school:'formal',
    tag:'logic', cd:10, mult:0, effect:'guard',
    desc:'两千年里没人能证明它，也没人能不用它。既然如此，你可以选择另一条平行线——5 秒内伤害减免 60%。',
    quote:'"过直线外一点，有且只有一条平行线。"——或者不止一条。',
    source:'第 3 学派 · 第 3 轮精英（黎曼）',
  },
  {
    id:'tongyu', name:'同余', emoji:'🔁', type:'skill', q:0, rate:0.40, school:'formal',
    tag:'logic', cd:9, mult:2.9, effect:'execute',
    desc:'在模 n 的世界里，两数之差被 n 整除即视为相同。对生命低于 35% 的敌人伤害翻倍——余数终将归零。',
    quote:'"数学是科学的皇后。"——高斯',
    source:'第 3 学派 · 稀有掉落',
  },
  {
    id:'jihe', name:'几何原本', emoji:'📜', type:'attr', q:0, rate:0.80, school:'formal',
    attr:{insight:6, rigor:8, fortitude:2, intuition:4, precision:3, eloquence:7, celerity:2},
    desc:'五条公理、五条公设，推出四百六十五条命题。人类第一次证明"证明"本身可以传授。',
    quote:'"几何无王者之路。"',
    source:'第 3 学派 · 欧几里得首杀',
  },
  {
    id:'suanshu', name:'算术研究', emoji:'🧮', type:'attr', q:0, rate:0.46, school:'formal',
    attr:{rigor:7, fortitude:2, intuition:4, precision:3},
    desc:'一本只有七章的书，把整座数论的地基重铺了一遍。同余符号就诞生在这里。',
    quote:'"数学中的美，是不允许妥协的。"',
    source:'第 3 学派 · 第 2 轮精英（高斯）',
  },
  {
    id:'wuqiongxiao', name:'无穷小分析', emoji:'∂', type:'attr', q:0, rate:0.48, school:'formal',
    attr:{insight:7, eloquence:7, celerity:2},
    desc:'欧拉失明后的十七年里，口述了十几卷著作。他把无穷小当成一个可以计算的数。',
    quote:'"我现在什么也看不见了，但我的手还记得。"',
    source:'第 3 学派 · 欧几里得首杀',
  },

  /* ---------- 博物学派 ---------- */
  {
    id:'qiyuan', name:'物种起源', emoji:'🐢', type:'skill', q:0, rate:1.6, school:'natural',
    tag:'life', cd:6, mult:3.4, effect:'dot',
    desc:'二十二年不敢发表的结论。持续伤害可无限叠加，每层独立计时——变化从不停下。',
    quote:'「存活下来的不是最强壮的，而是对变化反应最快的。」',
    source:'博物学派 · 达尔文首杀',
  },
  {
    id:'ziranxitong', name:'自然系统', emoji:'🌿', type:'attr', q:0, rate:3.2, school:'natural',
    attr:{insight:14, rigor:6, fortitude:2, intuition:7, precision:5, eloquence:7, celerity:2},
    desc:'给万物命名的野心之作。界、门、纲、目、科、属、种——先有名字，才有秩序。',
    quote:'「如果你不知道它的名字，关于它的知识就会消失。」',
    source:'博物学派 · 稀有掉落',
  },

  /* ---------- 热力学派 ---------- */
  {
    id:'reqixunhuan', name:'热机循环', emoji:'🚂', type:'skill', q:0, rate:8, school:'thermal',
    tag:'force', cd:8, mult:4.0, effect:'burst',
    desc:'卡诺想象的机器：等温膨胀、绝热膨胀、等温压缩、绝热压缩。五段爆发，每段都踩在循环的节拍上。',
    quote:'「效率的上限不在工艺里，在自然里。」',
    source:'热力学派 · 卡诺首杀',
  },
  {
    id:'shang', name:'熵之书', emoji:'🌀', type:'attr', q:0, rate:16, school:'thermal',
    attr:{insight:20, rigor:13, fortitude:3, intuition:8, precision:6, eloquence:9, celerity:3},
    desc:'一本越读越厚的书，因为无序只会增加。它教你一件事：所有秩序都要付出代价。',
    quote:'「没有人真正理解熵，但每个人都在使用它。」',
    source:'热力学派 · 稀有掉落',
  },

  /* ---------- 光学派 ---------- */
  {
    id:'bodong', name:'波动说', emoji:'〰️', type:'skill', q:0, rate:42, school:'optic',
    tag:'field', cd:7, mult:4.7, effect:'chain',
    desc:'光不是微粒，是一种振动。三段跳弹，像波在缝隙里分叉又合拢。',
    quote:'「光是一种振动——只是没人知道在振动什么。」',
    source:'光学派 · 菲涅尔首杀',
  },
  {
    id:'guangxingcha', name:'光行差', emoji:'🔭', type:'attr', q:0, rate:84, school:'optic',
    attr:{insight:34, rigor:21, fortitude:5, intuition:17, precision:13, eloquence:17, celerity:5},
    desc:'恒星的视位置随地球公转而偏移。测出这个偏移量，你才算真的在观察——而不是在看。',
    quote:'「测量一切可测量的。」',
    source:'光学派 · 稀有掉落',
  },

  /* ---------- 量子学派 ---------- */
  {
    id:'yueqian', name:'跃迁', emoji:'🪜', type:'skill', q:0, rate:220, school:'quantum',
    tag:'field', cd:9, mult:5.5, effect:'execute',
    desc:'电子从不经过中间地带，它只出现在两个能级之一。对残血目标伤害翻倍——结局不经过过程。',
    quote:'「任何不被禁止的，都是必须的。」',
    source:'量子学派 · 玻尔首杀',
  },
  {
    id:'cebuzhun', name:'测不准', emoji:'🎲', type:'attr', q:0, rate:440, school:'quantum',
    attr:{insight:52, rigor:35, fortitude:9, intuition:32, precision:26, eloquence:29, celerity:9},
    desc:'位置和动量不可同时精确。你越用力看，世界越模糊——但模糊本身给了你直觉。',
    quote:'「不是仪器不够好，是自然不允许。」',
    source:'量子学派 · 稀有掉落',
  },

  /* ---------- 化学派 ---------- */
  {
    id:'zhiliang', name:'质量守恒', emoji:'⚖️', type:'skill', q:0, rate:1150, school:'chem',
    tag:'life', cd:6, mult:6.4, effect:'strike',
    desc:'烧完之后，重量一毫克都没少。沉重、直接、不容辩驳的一击。',
    quote:'「自然界什么都不创造，只是重新排列。」',
    source:'化学派 · 拉瓦锡首杀',
  },
  {
    id:'ranshao', name:'燃烧概论', emoji:'🔥', type:'attr', q:0, rate:2300, school:'chem',
    attr:{insight:88, rigor:59, fortitude:15, intuition:36, precision:30, eloquence:45, celerity:15},
    desc:'它推翻了燃素，也推翻了一个时代的常识。拉瓦锡写完它的次年上了断头台。',
    quote:'「再造一个这样的脑袋，要一百年。」',
    source:'化学派 · 稀有掉落',
  },

  /* ==========================================================
     对人的学科：哲学 / 宗教 / 金融
     它们几乎不会成为任何敌人的抗性 —— 但对付「具体的人」比对付自然现象更管用。
     后期几位名人的额外弱点就落在这三门里（牛顿的神学与炒股、特斯拉的穷困…）。
     ========================================================== */
  {
    id:'chanhui', name:'忏悔录', emoji:'🕯️', type:'attr', q:0, rate:1.6, tag:'theology', doctrine:'诠释',
    attr:{insight:9, intuition:2, precision:1},
    desc:'奥古斯丁把自己的一生摊开，从头到尾审了一遍。他发明了一种写法：不是记录做了什么，而是追问为什么。',
    quote:'「主啊，你为自己造了我们，我们的心在安息于你之前，不得安宁。」',
    source:'第 1 轮 · 第 22 关首通',
  },
  {
    id:'lixiangguo', name:'理想国', emoji:'🏛️', type:'skill', q:0, rate:6, tag:'philosophy', doctrine:'先验',
    cd:10, mult:1.25, effect:'aoe',
    desc:'洞穴里的人把墙上的影子当成全部世界。你把火举起来，让影子散掉——全场伤害。',
    quote:'「他们一生都以为那些影子就是真实。」',
    source:'电气派 · 精英掉落',
  },
  {
    id:'chensi', name:'第一哲学沉思集', emoji:'🕳️', type:'skill', q:0, rate:30, tag:'philosophy', doctrine:'先验',
    cd:8, mult:0, effect:'guard',
    desc:'把一切可疑的都扔掉，直到剩下那个不能怀疑的东西：正在怀疑的你。5 秒内受伤 -60%，并清掉自身所有负面。',
    quote:'「我思，故我在。」',
    source:'电气派 · 第 3 轮首通',
  },
  {
    id:'guofu', name:'国富论', emoji:'⚒️', type:'attr', q:0, rate:120, tag:'finance', doctrine:'归纳',
    attr:{insight:18, eloquence:9, celerity:3, rigor:6, fortitude:2},
    desc:'一根针由一个人做，一天做不出二十根；分成十八道工序，一天能做出四千八百根。分工这件事，从此有了账本。',
    quote:'「我们的晚餐并非来自屠夫、酿酒师和面包师的恩惠。」',
    source:'形式派 · 精英掉落',
  },
  {
    id:'shangdicheng', name:'上帝之城', emoji:'⛪', type:'skill', q:0, rate:320, tag:'theology', doctrine:'诠释',
    cd:9, mult:1.2, effect:'reflect',
    desc:'罗马陷落了，他把目光移向另一座城。3 秒内反弹 45% 所受伤害——地上的城会塌，这座不会。',
    quote:'「两座城由两种爱造成。」',
    source:'博物派 · 精英掉落',
  },
  {
    id:'chuncui', name:'纯粹理性批判', emoji:'🧊', type:'attr', q:0, rate:700, tag:'philosophy', doctrine:'先验',
    attr:{rigor:21, fortitude:5, intuition:12, precision:10, insight:10},
    desc:'他从不走出家门，却把「人能认识什么」划了一条线。线内的叫知识，线外的叫信仰——两者从此各归各位。',
    quote:'「我不得不悬置知识，以便为信仰留出地盘。」',
    source:'博物派 · 第 3 轮首通',
  },
  {
    id:'ziranshenxue', name:'自然神学', emoji:'⌚', type:'skill', q:0, rate:1100, tag:'theology', doctrine:'归纳',
    cd:8, mult:0.55, effect:'dot',
    desc:'在路上捡到一块表，你不会认为它是风吹出来的——所以世界一定有个制表匠。这个论证后来被休谟拆了，但它撑了一百年。',
    quote:'「每一处都有造物的痕迹。」',
    source:'热力派 · 精英掉落',
  },
  {
    id:'tonglun', name:'就业、利息和通论', emoji:'📉', type:'skill', q:0, rate:1700, tag:'finance', doctrine:'计算',
    cd:7, mult:2.0, effect:'execute',
    desc:'需求不足时，市场不会自己恢复。他把这句话写进书里，然后建议政府去花钱。对残血目标伤害翻倍。',
    quote:'「长期来看，我们都死了。」',
    source:'光学派 · 第 3 轮首通',
  },
  {
    id:'nanhai', name:'南海泡沫小册', emoji:'🫧', type:'skill', q:0, rate:2200, tag:'finance', doctrine:'计算',
    cd:11, mult:0.62, effect:'burst',
    desc:'一张纸在公司还没做成任何事之前涨了十倍，然后在几个月里跌回原点。牛顿也在里面，赔掉了他十年的薪水。连续 5 段爆发。',
    quote:'「我能算出天体的运行，却算不出人类的疯狂。」',
    source:'化学派 · 第 3 轮首通',
  },

];

/* ----------------------------------------------------------
   3 个合成配方
   ---------------------------------------------------------- */
const RECIPES = [
  {
    id:'r1', a:'luoti', b:'guanxing', lv:10, out:'jixian',
    name:'极限逼近',
    text:'落体 + 惯性：位置对时间求导是速度，再求导是力。你把"变化"本身写成了式子。',
  },
  {
    id:'r2', a:'wanyou', b:'dianci', lv:12, out:'tongyi',
    name:'统一场论残页',
    text:'引力与电磁，两种相隔最远的东西，你试图用同一个符号把它们写完。',
  },
  {
    id:'r3', a:'yuanli', b:'liangmen', lv:10, out:'shougao',
    name:'手稿·批注本',
    text:'把两代人的手稿并排摊开，页边的争辩还活着。',
  },
];

/* 合成失败时的彩蛋概率 */
const EASTER_EGG_CHANCE = 0.08;

/* ----------------------------------------------------------
   学派：每个学派 8 关 × 3 轮 = 24 关，全局关卡序号连续递增
   力学 0–23，电气 24–47
   ---------------------------------------------------------- */
const STAGES_PER_SCHOOL = 24;

/* 书桌：6 个槽位，3 列 2 行。相邻加成只看同行左右 */
const DESK_SLOTS = 6;
const DESK_COLS = 3;

const SCHOOLS = [
  {
    id:'mechanics', name:'力学学派', short:'力学', doctrine:'实证', mult:1,
    blueprint:[
      { n:'惯性微粒', e:'🌀', weak:'force',  resist:'motion', k:'normal' },
      { n:'落体幽灵', e:'🍎', weak:'motion', resist:'field',  k:'normal' },
      { n:'摩擦之壁', e:'🧱', weak:'force',  resist:'logic',  k:'normal' },
      { n:'精英',     e:'🔭', weak:'logic',  resist:'motion', k:'elite'  },
      { n:'摆锤',     e:'⏱️', weak:'motion', resist:'force',  k:'normal' },
      { n:'抛物线',   e:'📐', weak:'field',  resist:'force',  k:'normal' },
      { n:'离心力',   e:'🎡', weak:'force',  resist:'logic',  k:'normal' },
      { n:'BOSS',     e:'🍏', weak:'field',  resist:'force',  k:'boss'   },
    ],
    elites:['伽利略', '胡克', '笛卡尔'],
    bosses:['牛顿', '牛顿 · 三定律', '牛顿 · 绝对时空'],
    bossLines:[
      '「你以为把石头扔上去又落下来，就算懂了天？」',
      '「惯性、加速度、作用与反作用——你以为背下来就等于掌握？」',
      '「时间与空间，是绝对的。你凭什么改写我？」',
    ],
    epitaphs:[
      '「如果说我看得更远，那是因为我站在巨人的肩上。」',
      '「我不作假说。」——Hypotheses non fingo',
      '「真理总在简单之中，而不在繁杂与混乱之中。」',
    ],
    rare:{ id:'mojing', chance:0.03 },
  },
  {
    id:'electric', name:'电气学派', short:'电气', doctrine:'实证', mult:7,
    blueprint:[
      { n:'静电',   e:'⚡', weak:'force',  resist:'field',  k:'normal' },
      { n:'电流',   e:'🔌', weak:'motion', resist:'field',  k:'normal' },
      { n:'磁场',   e:'🧲', weak:'field',  resist:'force',  k:'normal' },
      { n:'精英',   e:'🔋', weak:'field',  resist:'motion', k:'elite'  },
      { n:'电感',   e:'🧵', weak:'motion', resist:'field',  k:'normal' },
      { n:'电弧',   e:'✨', weak:'force',  resist:'motion', k:'normal' },
      { n:'共振',   e:'📻', weak:'field',  resist:'force',  k:'normal' },
      { n:'BOSS',   e:'🗼', weak:'force',  resist:'field',  k:'boss', d:'诠释' },
    ],
    elites:['法拉第', '安培', '赫兹'],
    bosses:['特斯拉', '特斯拉 · 交流电之战', '特斯拉 · 无线传输'],
    bossLines:[
      '「你还在数苹果？我已经让整座城市的灯亮起来了。」',
      '「直流？交流？——电不是拿来服从的，是拿来驾驭的。」',
      '「我不用导线也能点亮世界。你的定律够得着吗？」',
    ],
    epitaphs:[
      '「现在的世界还没有准备好接受它。但迟早会。」',
      '「我只要一个频率，就能让整座城市共振。」',
      '「发明家最大的悲哀，是想让同时代的人理解他。」',
    ],
    rare:{ id:'lundianci', chance:0.03 },
  },
  {
    id:'formal', name:'形式学派', short:'形式', doctrine:'演绎', mult:42,
    blueprint:[
      { n:'点',     e:'📍', weak:'logic',  resist:'field',  k:'normal' },
      { n:'线',     e:'📏', weak:'logic',  resist:'force',  k:'normal' },
      { n:'无穷小', e:'🪶', weak:'logic',  resist:'motion', k:'normal' },
      { n:'精英',   e:'∑',  weak:'logic',  resist:'field',  k:'elite'  },
      { n:'悖论',   e:'♾️', weak:'motion', resist:'logic',  k:'normal', d:'归纳' },
      { n:'虚数',   e:'🧿', weak:'field',  resist:'logic',  k:'normal', d:'归纳' },
      { n:'极限',   e:'🎯', weak:'logic',  resist:'force',  k:'normal' },
      { n:'BOSS',   e:'📐', weak:'force',  resist:'logic',  k:'boss'   },
    ],
    elites:['欧拉', '高斯', '黎曼'],
    bosses:['欧几里得', '欧几里得 · 公理体系', '欧几里得 · 第五公设'],
    bossLines:[
      '「点是没有部分的东西。你连这个都要怀疑？」',
      '「从五条公理出发，我可以推出整个世界。你要推翻哪一条？」',
      '「平行线永不相交——除非你换一个平面。你敢换吗？」',
    ],
    epitaphs:[
      '「几何无王者之路。」',
      '「整体大于部分。」——这句话他证明了 465 次中的第一次。',
      '「平行线永不相交——在你定义的那个平面里。」',
    ],
    rare:{ id:'tongyu', chance:0.04 },
  },
  {
    id:'natural', name:'博物学派', short:'博物', doctrine:'归纳', mult:270,
    blueprint:[
      { n:'孢子',   e:'🍄', weak:'force',  resist:'logic',  k:'normal' },
      { n:'苔藓',   e:'🌿', weak:'field',  resist:'motion', k:'normal' },
      { n:'甲虫',   e:'🪲', weak:'logic',  resist:'force',  k:'normal' },
      { n:'精英',   e:'🔍', weak:'logic',  resist:'field',  k:'elite'  },
      { n:'候鸟',   e:'🕊️', weak:'motion', resist:'logic',  k:'normal' },
      { n:'化石',   e:'🦴', weak:'field',  resist:'motion', k:'normal' },
      { n:'变异',   e:'🧬', weak:'logic',  resist:'force',  k:'normal', d:'实证' },
      { n:'BOSS',   e:'🐢', weak:'motion', resist:'logic',  k:'boss'   },
    ],
    elites:['林奈', '布丰', '居维叶'],
    bosses:['达尔文', '达尔文 · 贝格尔号', '达尔文 · 共同祖先'],
    bossLines:[
      '「二十年的笔记，只为了一句我不敢写下的结论。」',
      '「你说物种是固定的。那你解释一下，为什么它们长得这么像？」',
      '「把所有生命放在一棵树上——你站在最末端的那根枝条上。」',
    ],
    epitaphs:[
      '「存活下来的不是最强壮的，也不是最聪明的，而是对变化反应最快的。」',
      '「我不相信有一个固定的终点。」',
      '「有一种壮丽：生命从最简单的形式开始，无尽演化。」',
    ],
    rare:{ id:'qiyuan', chance:0.03 },
  },
  {
    id:'thermal', name:'热力学派', short:'热力', doctrine:'归纳', mult:1800,
    blueprint:[
      { n:'分子',   e:'⚛️', weak:'field',  resist:'logic',  k:'normal' },
      { n:'传导',   e:'🔥', weak:'motion', resist:'field',  k:'normal' },
      { n:'膨胀',   e:'🎈', weak:'force',  resist:'motion', k:'normal' },
      { n:'精英',   e:'⚗️', weak:'logic',  resist:'force',  k:'elite'  },
      { n:'蒸汽',   e:'💨', weak:'field',  resist:'logic',  k:'normal' },
      { n:'熵增',   e:'🌀', weak:'logic',  resist:'motion', k:'normal', d:'先验' },
      { n:'热寂',   e:'🌑', weak:'force',  resist:'field',  k:'normal', d:'先验' },
      { n:'BOSS',   e:'🚂', weak:'motion', resist:'force',  k:'boss'   },
    ],
    elites:['焦耳', '克劳修斯', '玻尔兹曼'],
    bosses:['卡诺', '卡诺 · 理想热机', '卡诺 · 不可逆'],
    bossLines:[
      '「效率有个上限，不是技术问题，是自然的法则。」',
      '「你可以无限接近它，但你永远到不了。」',
      '「所有热机最终都会坏。包括你。」',
    ],
    epitaphs:[
      '「没有人真正理解熵。但每个人都在使用它。」',
      '「宇宙的能量守恒，宇宙的熵不守恒。」',
      '「时间的箭头，只是熵在增长。」',
    ],
    rare:{ id:'shang', chance:0.03 },
  },
  {
    id:'optic', name:'光学派', short:'光学', doctrine:'实证', mult:11500,
    blueprint:[
      { n:'影',     e:'🌑', weak:'field',  resist:'logic',  k:'normal' },
      { n:'反射',   e:'🪞', weak:'force',  resist:'motion', k:'normal' },
      { n:'折射',   e:'💧', weak:'motion', resist:'field',  k:'normal' },
      { n:'精英',   e:'🔎', weak:'logic',  resist:'force',  k:'elite'  },
      { n:'干涉',   e:'🌈', weak:'field',  resist:'logic',  k:'normal' },
      { n:'衍射',   e:'〰️', weak:'motion', resist:'force',  k:'normal' },
      { n:'偏振',   e:'🕶️', weak:'logic',  resist:'motion', k:'normal', d:'诠释' },
      { n:'BOSS',   e:'💡', weak:'force',  resist:'field',  k:'boss'   },
    ],
    elites:['惠更斯', '杨', '马吕斯'],
    bosses:['菲涅尔', '菲涅尔 · 横波', '菲涅尔 · 以太'],
    bossLines:[
      '「如果光是粒子，它为什么会在角落里拐弯？」',
      '「我算出了全部条纹的位置。你们要的证明，在数学里。」',
      '「以太不存在也没关系——方程照旧成立。」',
    ],
    epitaphs:[
      '「光是一种振动，只是没人知道在振动什么。」',
      '「最简洁的假设，往往是对的。」',
      '「我活着看见了它被人接受。这比发现本身更罕见。」',
    ],
    rare:{ id:'bodong', chance:0.03 },
  },
  {
    id:'quantum', name:'量子学派', short:'量子', doctrine:'诠释', mult:75000,
    blueprint:[
      { n:'光子',   e:'✨', weak:'logic',  resist:'motion', k:'normal' },
      { n:'能级',   e:'🪜', weak:'field',  resist:'force',  k:'normal' },
      { n:'波包',   e:'🌊', weak:'motion', resist:'logic',  k:'normal' },
      { n:'精英',   e:'🎲', weak:'force',  resist:'field',  k:'elite'  },
      { n:'叠加',   e:'🐈', weak:'logic',  resist:'motion', k:'normal' },
      { n:'纠缠',   e:'🔗', weak:'field',  resist:'logic',  k:'normal', d:'先验' },
      { n:'隧穿',   e:'🚇', weak:'force',  resist:'field',  k:'normal', d:'计算' },
      { n:'BOSS',   e:'👁️', weak:'motion', resist:'logic',  k:'boss', d:'计算' },
    ],
    elites:['海森堡', '薛定谔', '狄拉克'],
    bosses:['玻尔', '玻尔 · 互补原理', '玻尔 · 哥本哈根诠释'],
    bossLines:[
      '「如果你不为量子力学感到震惊，说明你没听懂。」',
      '「位置和动量，你只能问一个。不是仪器不够好，是自然不允许。」',
      '「观测之前，月亮在哪里？——这个问题本身就是错的。」',
    ],
    epitaphs:[
      '「任何不被禁止的，都是必须的。」',
      '「预测个别事件是不可能的，我们能预测的只有概率。」',
      '「物理学不告诉我们世界是什么，只告诉我们关于世界能说什么。」',
    ],
    rare:{ id:'yueqian', chance:0.03 },
  },
  {
    id:'chem', name:'化学派', short:'化学', doctrine:'诠释', mult:490000,
    blueprint:[
      { n:'燃素',   e:'💨', weak:'logic',  resist:'force',  k:'normal' },
      { n:'煅烧',   e:'⚗️', weak:'force',  resist:'motion', k:'normal' },
      { n:'天平',   e:'⚖️', weak:'logic',  resist:'field',  k:'normal' },
      { n:'精英',   e:'🧪', weak:'motion', resist:'logic',  k:'elite'  },
      { n:'氧气',   e:'🫧', weak:'field',  resist:'force',  k:'normal' },
      { n:'定比',   e:'📊', weak:'logic',  resist:'motion', k:'normal' },
      { n:'合成',   e:'🧫', weak:'force',  resist:'field',  k:'normal', d:'计算' },
      { n:'BOSS',   e:'🔥', weak:'motion', resist:'logic',  k:'boss'   },
    ],
    elites:['普利斯特里', '舍勒', '道尔顿'],
    bosses:['拉瓦锡', '拉瓦锡 · 质量守恒', '拉瓦锡 · 元素表'],
    bossLines:[
      '「自然界什么都不创造，什么都不消灭，只是重新排列。」',
      '「把天平放上去。烧完之后，重量一毫克都没少。」',
      '「燃素从未存在过。你需要的是一份元素清单。」',
    ],
    epitaphs:[
      '「化学必须像数学一样，从清晰的概念开始。」',
      '「他被断头台带走了，但他的元素表留下了。」',
      '「有人说他脑袋被砍下来只要一秒，而再造一个这样的脑袋要一百年。」',
    ],
    rare:{ id:'zhiliang', chance:0.03 },
  },
];

const KIND_MULT = { normal:1, elite:2.0, boss:2.6 };
const KIND_NAME = { normal:'', elite:'精英', boss:'BOSS' };

/* ---- 全局数值开关（调平衡只动这一段）---- */
const UPGRADE_BASE   = 10;    // 升级基础成本
const UPGRADE_GROWTH = 1.19;  // 每级成本增长
const LV_ATTR_BONUS  = 0.09;  // 属性书每级 +9%
const LV_RATE_BONUS  = 0.11;  // 洞见产出每级 +11%
const LV_SKILL_BONUS = 0.06;  // 技能书每级 +6%
const PRESTIGE_DIV   = 6000;  // 范式 = floor(sqrt(累计洞见 / 该值)) —— 越小越快拿到点数
/* 范式获取的软上限：超过后收益转为对数增长。
   因为范式加成是复利，若点数也指数增长就会双重指数 → paraMul 溢出成 Infinity。
   PRESTIGE_SOFT 之内按 sqrt 正常给，之后每 10 倍洞见只多给 PRESTIGE_SOFT_LOG 点。 */
const PRESTIGE_SOFT     = 42;
const PRESTIGE_SOFT_LOG = 12;
const PRESTIGE_CAP      = 70;   // 单次转生最多给这么多点 —— 一次只够回本 1–2 个纪元
const PARADIGM_CAP      = 4000; // paraMul 计算时钳制：1.025^4000 ≈ 1e43，安全
const PARADIGM_MIGRATE  = 260;  // 旧存档超过这个点数就按对数压缩重标定（v2→v3）
const PARA_BONUS     = 0.03; // 每点范式自动全局加成（累计值算，不因花在天赋上而减少）
/* 范式的边际递减：前 PARADIGM_SOFT_POINTS 点按全速复利，之后每点只按 40% 计入。
   这是为了砍掉「转几次就无敌」的手感 —— 前期仍然爽，后期不再指数爆炸。 */
const PARADIGM_SOFT_POINTS = 150;
const PARADIGM_SOFT_RATE   = 0.50;
const ERA_MULT       = 1.8;   // 每推进一个纪元，敌人数值 ×该值
/* 转生回本线 = ln(ERA_MULT)/ln(1+PARA_BONUS) ≈ 23 点。
   单次给 48 点 ≈ 1.035^48 = 5.2 倍 ≈ 2 个纪元的强度 —— 手感是"略强一档"，不是"一键通关"。 */
const AUTO_ATK_MULT  = 0.35;  // 普通攻击 = 攻击力 × 该值，每秒一次（压低保底输出，逼玩家靠书）

/* 关卡数值：hp = 100 × 学派系数 × 1.23^学派内序号 × 类型系数
   学派系数让每个学派从自己的难度起点重新爬，而不是接着上一个学派的第 3 轮 */
const STAGE_BASE_HP = 100;
const STAGE_GROWTH  = 1.23;
const ENEMY_BASE_ATK = 1.2;
const ENEMY_ATK_GROWTH = 1.16;
const BATTLE_TIME = 45;

/* 每关掉落书页 */
const PAGE_DROP = { normal:12, elite:48, boss:170 };

/* 首通必得（全局关卡序号）*/
const STAGE_DROPS = {
  3:  [{ id:'liangmen', chance:1 }],
  4:  [{ id:'guanxing', chance:1 }],
  7:  [{ id:'wanyou', chance:1 }, { id:'yuanli', chance:1 }],
  11: [{ id:'yuanzhui', chance:1 }, { id:'fanzuoyong', chance:1 }],
  15: [{ id:'fangfalun', chance:1 }],
  23: [{ id:'dianci', chance:1 }],
  /* 电气学派 */
  27: [{ id:'jiaoliu', chance:1 }],
  28: [{ id:'dianci', chance:1 }],
  31: [{ id:'xianquan', chance:1 }, { id:'dianxue', chance:1 }],
  35: [{ id:'lundianci', chance:1 }],
  39: [{ id:'diancitonglun', chance:1 }],
  47: [{ id:'luolunzi', chance:1 }],
  /* 形式学派 */
  51: [{ id:'jishu', chance:1 }],
  55: [{ id:'jihe', chance:1 }, { id:'wuqiongxiao', chance:1 }],
  59: [{ id:'suanshu', chance:1 }],
  67: [{ id:'digongshe', chance:1 }],
  /* 博物学派（72–95） */
  75: [{ id:'ziranxitong', chance:1 }],
  79: [{ id:'qiyuan', chance:1 }],
  87: [{ id:'ziranxitong', chance:1 }],
  /* 热力学派（96–119） */
  99: [{ id:'shang', chance:1 }],
  103: [{ id:'reqixunhuan', chance:1 }],
  111: [{ id:'shang', chance:1 }],
  /* 光学派（120–143） */
  123: [{ id:'guangxingcha', chance:1 }],
  127: [{ id:'bodong', chance:1 }],
  135: [{ id:'guangxingcha', chance:1 }],
  /* 量子学派（144–167） */
  147: [{ id:'cebuzhun', chance:1 }],
  151: [{ id:'yueqian', chance:1 }],
  159: [{ id:'cebuzhun', chance:1 }],
  /* 化学派（168–191） */
  171: [{ id:'ranshao', chance:1 }],
  175: [{ id:'zhiliang', chance:1 }],
  183: [{ id:'ranshao', chance:1 }],
};

/* 知识卡（Boss 首杀，全局关卡序号） */
const CARDS = [
  { id:'c1', boss:7,  title:'绝对时空', text:'"绝对的、真实的、数学的时间，由于其本性，均匀地流逝，与任何外界事物无关。"——《原理》开篇。你打赢了他，但你仍在用他的时间里活着。' },
  { id:'c2', boss:15, title:'巨人的肩膀', text:'"如果说我看得更远，那是因为我站在巨人的肩上。"这句话写给他的对手胡克——一个被他从画像里抹掉的人。' },
  { id:'c3', boss:23, title:'夹页里的便签', text:'在《原理》第三版的夹页里，有一张不属于这个世纪的纸。上面画着一个线圈和一块磁铁，还有一行字："变化产生场。"' },
  { id:'c4', boss:31, title:'旋转的磁场', text:'"让磁场转起来，转子就会自己跟上。"特斯拉在纸上画了两个圈，然后把交流电的频率写在了中间。他没有解释为什么，只写了三个字：也许是。' },
  { id:'c5', boss:39, title:'以太的葬礼', text:'麦克斯韦写下方程组的那一年，没有人相信电磁波真的存在。二十多年后赫兹在实验室里看见了它。他说："这东西没有用。"——然后全世界都用上了。' },
  { id:'c7', boss:55, title:'没有部分的东西', text:'"点是没有部分的东西。"——这句话是《几何原本》的第一句。它不可证明，也不必证明。你意识到：所有庞大的体系，都站在一句无法验证的话上。' },
  { id:'c8', boss:63, title:'第五公设', text:'两千年里，无数人试图证明第五公设，全部失败。后来有人换了个方向：假设它不成立。于是非欧几何诞生了。有些墙不是用来翻的，是用来绕的。' },
  { id:'c9', boss:71, title:'无王者之路', text:'"几何无王者之路。"据说这是给一位想走捷径的国王的答复。你把这本书合上时，听见远处有人在争论平行线到底会不会相交——他们还会再吵两千年。' },
  { id:'c6', boss:47, title:'不用导线的塔', text:'沃登克里弗塔的账本最后一页只有一行字：「再给我一点时间。」它没有建成。但你现在能读到这一页，说明他想的事，有人接着想了。' },

  /* 博物学派 */
  { id:'c10', boss:79, title:'二十二年', text:'达尔文在 1837 年写下第一页笔记，1859 年才出版。中间二十二年，他什么都没说——包括对他自己的信仰。' },
  { id:'c11', boss:95, title:'最末端的枝条', text:'他把所有生命画成一棵树。你没有找到人类在哪根枝条上——你发现那棵树根本没有顶端。' },

  /* 热力学派 */
  { id:'c12', boss:103, title:'卡诺的理想', text:'他设想了一台永远不存在的机器：无摩擦、无散热、循环可逆。它造不出来，但它给出了所有真实机器的上限。' },
  { id:'c13', boss:119, title:'时间之箭', text:'物理定律对时间是对称的，但熵不是。你终于知道为什么记得昨天、不记得明天。' },

  /* 光学派 */
  { id:'c14', boss:127, title:'角落里的光', text:'如果光走直线，阴影边缘不该有条纹。菲涅尔算出了那些条纹的位置——顺带证明了光根本不是直线走的。' },
  { id:'c15', boss:143, title:'以太的缺席', text:'所有寻找以太的实验都失败了。后来人们承认：根本不需要它。那道光穿过虚空，不需要任何东西来承载。' },

  /* 量子学派 */
  { id:'c16', boss:151, title:'盒子里的猫', text:'在打开之前，它既活着又死了。薛定谔写这个思想实验是为了嘲笑它——结果它成了最著名的解释。' },
  { id:'c17', boss:167, title:'闭上眼睛的月亮', text:'"不观测时月亮在哪里？"玻尔的回答是：这个问题没有意义。物理学不描述世界，只描述我们能说什么。' },

  /* 化学派 */
  { id:'c18', boss:175, title:'一毫克', text:'拉瓦锡把天平摆在燃烧实验旁。灰烬变重了——因为他终于承认，空气也参与了反应。' },
  { id:'c19', boss:191, title:'最后一页', text:'他被处决于 1794 年 5 月 8 日。法庭驳回了他"请求延缓几日以完成一项实验"的请求。那份实验，至今没有人做完。' },
];

/* ----------------------------------------------------------
   纪元：范式转移 = 进入下一纪元。敌人整体变强，学派按新顺序重排
   ---------------------------------------------------------- */
const ERA_NAMES = ['常识', '怀疑', '重构', '决裂', '理念'];

function eraName(era) {
  const loop = Math.floor((era - 1) / ERA_NAMES.length);
  const base = ERA_NAMES[(era - 1) % ERA_NAMES.length];
  return loop > 0 ? `第 ${era} 纪元 · ${base} ${loop + 1}` : `第 ${era} 纪元 · ${base}`;
}
function eraScale(era) { return Math.pow(ERA_MULT, Math.max(0, era - 1)); }

/* 纪元里学派的排列顺序：第 1 纪元按原序，之后每纪元轮转一位 */
function schoolOrder(era) {
  const n = SCHOOLS.length;
  const shift = ((era - 1) * 1) % n;
  return SCHOOLS.map((_, i) => SCHOOLS[(i + shift) % n]);
}

/* ----------------------------------------------------------
   天赋树：花范式点
   ---------------------------------------------------------- */
/* ==========================================================
   天赋树 v2 —— 三层结构
   ----------------------------------------------------------
   旧版只有 6 个天赋、点满只要 25 点范式，而玩家手里攒着 3000+ 点 —— 转生货币等于死钱。
   这一版：
     ① 基础层：原有的 6 个，便宜，早期就能点；
     ② 进阶层：八条数值线，让玩家能按自己的打法偏科；
     ③ 专精层：三选一、互斥、cost 翻倍递增 —— 这是范式的主要去处，
        也是「你选择成为哪一派的学者」这个决定发生的地方。
   ========================================================== */
const TALENTS = [
  /* ---- 基础层 ---- */
  { id:'insight',  name:'博览',     max:5, cost:1, cat:'base', kind:'num',
    desc:'洞见产出 +12% / 级' },
  { id:'power',    name:'锐利',     max:5, cost:1, cat:'base', kind:'num',
    desc:'攻击力 +12% / 级' },
  { id:'affinity', name:'洞察相性', max:3, cost:2, cat:'base', kind:'rule',
    desc:'克制倍率 1.25 → 每级 +0.05（最高 1.40）' },
  { id:'slot',     name:'加宽书桌', max:2, cost:2, cat:'base', kind:'rule',
    desc:'书桌 +1 槽（6 → 8）' },
  { id:'autoUp',   name:'自动升级', max:1, cost:2, cat:'base', kind:'auto',
    desc:'每 0.6 秒自动买一次最便宜的升级' },
  { id:'autoDesk', name:'自动换书', max:1, cost:3, cat:'base', kind:'auto',
    desc:'进入新关卡时自动按相性重排书桌' },

  /* ---- 进阶层：八条数值线，想偏科就偏科 ---- */
  { id:'page',     name:'批注',     max:5, cost:4,  cat:'adv', kind:'num',
    desc:'书页掉落 +10% / 级' },
  { id:'crit',     name:'明察',     max:5, cost:5,  cat:'adv', kind:'num',
    desc:'暴击率 +3% / 级（与直觉叠加后走同一条渐近曲线）' },
  { id:'critdmg',  name:'锐度',     max:5, cost:6,  cat:'adv', kind:'num',
    desc:'暴击伤害 +15% / 级' },
  { id:'cd',       name:'捷思',     max:5, cost:6,  cat:'adv', kind:'num',
    desc:'技能冷却 -4% / 级' },
  { id:'vitality', name:'守拙',     max:5, cost:4,  cat:'adv', kind:'num',
    desc:'生命 +15% / 级' },
  { id:'cut',      name:'沉稳',     max:5, cost:8,  cat:'adv', kind:'num',
    desc:'减伤 +3% / 级（与沉毅共享 80% 上限）' },
  { id:'drop',     name:'寻获',     max:3, cost:5,  cat:'adv', kind:'num',
    desc:'装备掉率 +2% / 级' },
  { id:'abyss',    name:'深潜',     max:5, cost:6,  cat:'adv', kind:'num',
    desc:'深渊书页 +25% / 级' },

  /* ---- 专精层：三选一，互斥。这是范式真正的去处 ---- */
  { id:'spec_emp', name:'实证派',   max:5, cost:60, costGrow:2, cat:'spec', kind:'spec',
    school:['实证','计算'],
    desc:'实证 / 计算 学派技能伤害 +25% / 级，其余学派 -8% / 级' },
  { id:'spec_her', name:'诠释派',   max:5, cost:60, costGrow:2, cat:'spec', kind:'spec',
    school:['诠释','归纳'],
    desc:'诠释 / 归纳 学派技能伤害 +25% / 级，其余学派 -8% / 级' },
  { id:'spec_rat', name:'理性派',   max:5, cost:60, costGrow:2, cat:'spec', kind:'spec',
    school:['演绎','先验'],
    desc:'演绎 / 先验 学派技能伤害 +25% / 级，其余学派 -8% / 级' },
];

/* 专精互斥：选了一条，另外两条就锁死 */
const SPEC_IDS = ['spec_emp', 'spec_her', 'spec_rat'];
function specChosen() { return SPEC_IDS.find(id => tal(id) > 0) || null; }
/* 专精第 n 级的花费：60 / 120 / 240 / 480 / 960 */
function specCost(t, lv) {
  return Math.round(t.cost * Math.pow(t.costGrow || 2, Math.max(0, lv)));
}
/* 某本书受专精影响的倍率：本派 +25%/级，其余 -8%/级 */
function specBookMul(book) {
  const sid = specChosen(); if (!sid) return 1;
  const t = TALENTS.find(x => x.id === sid); if (!t) return 1;
  const lv = tal(sid);
  const mine = t.school.indexOf(doctrineOf(book)) >= 0;
  return Math.max(0.2, 1 + (mine ? 0.25 : -0.08) * lv);
}

/* 理念之神：每纪元的终极挑战，可选，不挡纪元推进 */
const ERA_GOD = {
  name:'理念之神', emoji:'👁',
  desc:'它不属于任何一个学派，因此也不被任何一个学派说服。',
  hpBase: 3.0,      // 第一次挑战时，相对本纪元最后一个 Boss 的倍数
  atkBase: 2.2,
  /* 每击败一次，下一次的强度乘以该值 —— 指数级，不是线性。
     它是「你还能走多远」的标尺，不该被随手推倒。 */
  growth: 2.35,
  /* 击败奖励也随之增长：模式是「越难给得越多」，但增速低于难度 */
  rewardBase: 4,
  rewardGrowth: 1.6,
};

/* ==========================================================
   属性系统 2.0 —— 七维
   ----------------------------------------------------------
   旧版四个属性里，「直觉」堆到后期有 93% 的点数撞在 60% 硬顶上，
   等于白拿。这一版的原则：
     ① 有极限的东西（暴击率 / 减伤 / 冷却）一律用渐近曲线，
        永远逼近但永远不到 —— 点数不再有「超出部分不生效」；
     ② 不该有极限的东西（暴击伤害）就真的不给上限，线性堆；
     ③ 早期手感不能变：暴击率在 60% 之前仍是原来的线性 0.6%/点。
   ========================================================== */
const ATTR_NAME = {
  insight:'悟性', rigor:'严谨', intuition:'直觉', eloquence:'雄辩',
  precision:'精审', fortitude:'沉毅', celerity:'捷才',
};
const ATTR_ORDER = ['insight', 'rigor', 'intuition', 'eloquence', 'precision', 'fortitude', 'celerity'];
const ATTR_DESC = {
  insight:'洞见产出 +10% / 点',
  rigor:'攻击 +2 / 点，生命 +3 / 点',
  intuition:'暴击率（60% 前 +0.6% / 点，之后渐近至 99%）',
  eloquence:'技能伤害 +1.5% / 点',
  precision:'暴击伤害 +0.15% / 点（无上限）',
  fortitude:'减伤（渐近至 80%）',
  celerity:'冷却缩减（渐近至 ×0.30）',
};

/* --- 曲线参数：改平衡只动这里 --- */
/* 暴击率：60% 以内走线性；超出部分按 exp 衰减，极限 99% */
const CRIT_CAP      = 0.99;
const CRIT_LINEAR   = 0.60;   /* 线性段终点，早期手感与旧版完全一致 */
const CRIT_SOFT     = 6.0;    /* 超出线性段后，每多「600% 线性暴击率」衰减一个 e */
const CRIT_DMG_BASE = 1.8;    /* 基础暴击伤害 */
const CRIT_DMG_PER  = 0.0015; /* 精审每点 +0.15% 暴伤，无上限 */
/* 减伤：沉毅点数 → 渐近 80% */
const DMG_CUT_CAP   = 0.80;
const DMG_CUT_SOFT  = 600;
/* 冷却：捷才点数 → 冷却倍率渐近 ×0.30（即最多缩减 70%） */
const CD_FLOOR      = 0.30;
const CD_SOFT       = 600;

/* 暴击率：线性段 + 渐近段。
   raw 是「线性暴击率」（直觉×0.6% + 装备/组合加成），可以是 8.97 这种大数 */
function critFromRaw(raw) {
  const r = Math.max(0, raw || 0);
  if (r <= CRIT_LINEAR) return r;
  return CRIT_CAP - (CRIT_CAP - CRIT_LINEAR) * Math.exp(-(r - CRIT_LINEAR) / CRIT_SOFT);
}

/* ==========================================================
   装备系统 —— 实体物件，范式转移后保留在理念世界中
   书给「输出」，装备给「规则」：两套系统不重叠
   ========================================================== */

const EQUIP_SLOTS = [
  { id:'pen',    name:'笔',   icon:'🖋️', line:'技能冷却',   desc:'决定你多快能出手' },
  { id:'paper',  name:'纸',   icon:'📄', line:'书页掉率',   desc:'决定你多快能变强' },
  { id:'mirror', name:'镜',   icon:'🔍', line:'暴击与相性', desc:'决定你打得多准' },
  { id:'lamp',   name:'灯',   icon:'🕯️', line:'洞见产出',   desc:'决定你多快能思考' },
  { id:'robe',   name:'袍',   icon:'🧥', line:'生命与减伤', desc:'决定你能撑多久' },
  { id:'seal',   name:'印',   icon:'🔖', line:'范式与转生', desc:'决定下一轮起点' },
];

/* 装备品质 = 书的六档品质，词条数 = 档位 + 1 */
function equipAffixCount(q) { return Math.min(4, q + 1); }

/* 每个学派一套物件名，掉落的装备按所在学派命名 */
/* ============================================================
   装备命名：槽位 × 品质
   ------------------------------------------------------------
   低档是普通文具，越往上越接近某个人真正用过的东西。
   名字本身就是一句知识点 —— 玩家看一眼就知道它属于谁、为什么是这个槽位。
   ============================================================ */
const EQUIP_NAMES = {
  /* 笔：书写与施法 */
  pen:    ['炭条', '鹅毛笔', '制图钢笔', '达芬奇的银尖笔', '图灵的铅笔', '伽利略的圆规'],
  /* 纸：记录与留存 */
  paper:  ['草稿纸', '实验记录本', '编号笔记', '第谷的观测簿', '达芬奇手稿', '牛顿的手稿'],
  /* 镜：观察与精度 */
  mirror: ['磨制镜片', '放大镜', '伽利略的望远镜', '列文虎克的透镜', '胡克的显微图', '牛顿的反射镜'],
  /* 灯：照明与产出 */
  lamp:   ['鲸油灯', '煤气灯', '弧光灯', '戴维的矿灯', '特斯拉的无线灯', '爱迪生的灯泡'],
  /* 袍：护身与支撑 */
  robe:   ['亚麻外衣', '呢子外套', '学士袍', '拉瓦锡的实验围裙', '居里夫人的工装', '霍金的轮椅'],
  /* 印：身份与范式 */
  seal:   ['私人印章', '学会会员章', '学院徽记', '皇家学会会长印', '诺贝尔奖章', '爱因斯坦的烟斗'],
};

/* ============================================================
   概念（CONCEPT）：游戏里真正在流通的东西
   ------------------------------------------------------------
   一本书讲的是「某段历史」，一张卡讲的是「某个瞬间」，
   但底下真正被反复讨论的，是十几个概念：以太、熵、场、不确定性……

   同一个概念会在书、知识卡、BOSS 的怪癖、装备的专属能力里反复出现。
   每打通一处，你对它的理解就深一层 —— 而这一层会变成很小的数值加成。

   为什么加成故意做得很小（满级也就 2%–6%）：
   这是「读书的副产品」，不是「读书的目的」。它应该让你觉得「有点用」，
   而不是逼你去刷。真正值钱的是你知道这件事本身。
   ============================================================ */
const CONCEPTS = [
  {
    id:'motion', name:'运动', icon:'🏃',
    line:'一个东西为什么会动、为什么会停？在牛顿之前，所有人以为「停下来」才是自然状态。真正反直觉的是：不需要理由的是继续动，停下来才需要理由。',
    bonusText:'攻击力 +4%',
    rule:{ id:'inertia', name:'惯性', desc:'开场 5 秒内，普攻伤害 +12%。', line:'已经动起来的东西，不需要再推。' },
    stats:{ atkPct:0.04 },
    sources:[
      { type:'book', id:'luoti', note:'重量不再是速度的理由' },
      { type:'book', id:'guanxing', note:'没有外力，就永远这样下去' },
      { type:'book', id:'liangmen', note:'把实验变成可以传授的东西' },
    ],
  },
  {
    id:'aether', name:'以太', icon:'🫧',
    line:'一种被认为充满整个宇宙、专门用来承载光波的介质。所有寻找它的实验都失败了 —— 于是它被删掉了，光不再需要任何东西来托着。',
    bonusText:'技能冷却 -2%',
    rule:{ id:'medium', name:'介质', desc:'战斗开始时，全部技能冷却归零。', line:'总得有东西托着，振动才能立刻开始。' },
    stats:{ cdMul:-0.02 },
    sources:[
      { type:'book', id:'diancitonglun', note:'麦克斯韦方程组里还留着以太' },
      { type:'book', id:'bodong', note:'光被当成一种振动——振动得有介质' },
      { type:'card', id:'c5', note:'赫兹：这东西没有用' },
      { type:'card', id:'c15', note:'迈克尔逊-莫雷的零结果' },
      { type:'quirk', id:'ether', note:'菲涅尔的「以太护盾」' },
    ],
  },
  {
    id:'entropy', name:'熵', icon:'♨️',
    line:'一个只增不减的量。物理定律对时间几乎都是对称的，只有它不对称 —— 这就是为什么你记得昨天，不记得明天。',
    bonusText:'受到伤害 -3%',
    rule:{ id:'noReturn', name:'不可逆', desc:'敌人受到的治疗效果 -25%。', line:'倒回去的过程，从来不会自己发生。' },
    stats:{ dmgCut:0.03 },
    sources:[
      { type:'book', id:'shang', note:'一本越读越厚的书' },
      { type:'book', id:'reqixunhuan', note:'卡诺循环：效率的天花板' },
      { type:'card', id:'c12', note:'造不出来的理想机器' },
      { type:'card', id:'c13', note:'时间之箭' },
      { type:'quirk', id:'entropy', note:'卡诺的「熵增」' },
    ],
  },
  {
    id:'evolution', name:'演化', icon:'🌿',
    line:'不需要设计者的设计。只要有变异、遗传和选择，复杂的东西就会自己长出来 —— 这个过程没有方向，也没有终点。',
    bonusText:'持续伤害 +6%',
    rule:{ id:'adapt', name:'适应', desc:'连续使用同一本书，每次伤害 +2%（最多 +10%）。', line:'用得多，就长成了配合它的样子。' },
    stats:{ ampEq:0.06 },
    sources:[
      { type:'book', id:'qiyuan', note:'二十二年不敢发表' },
      { type:'book', id:'ziranxitong', note:'先有名字，才有秩序' },
      { type:'card', id:'c10', note:'达尔文的沉默' },
      { type:'card', id:'c11', note:'那棵树没有顶端' },
      { type:'combo', id:'redqueen', note:'红皇后：必须一直跑' },
    ],
  },
  {
    id:'axiom', name:'公理', icon:'📐',
    line:'不能被证明、也不必被证明的那句话。整个体系都站在它上面 —— 换掉它，你会得到另一个同样自洽的世界。',
    bonusText:'技能伤害 +3%',
    rule:{ id:'selfEvid', name:'自明', desc:'每场战斗的第一发技能伤害 +20%。', line:'一切推演，都从不需要证明的那句话开始。' },
    stats:{ ampEq:0.03 },
    sources:[
      { type:'book', id:'jihe', note:'五条公设推出四百六十五条命题' },
      { type:'book', id:'digongshe', note:'假设它不成立会怎样' },
      { type:'card', id:'c7', note:'点是没有部分的东西' },
      { type:'card', id:'c8', note:'第五公设：绕过去' },
      { type:'sig', id:'sigPrincipia', note:'牛顿手稿的「公理化」' },
    ],
  },
  {
    id:'field', name:'场', icon:'🌐',
    line:'两个物体不接触，力却传过去了。法拉第用「力线」把这件事画出来，麦克斯韦把它写成方程 —— 空间本身成了参与者。',
    bonusText:'暴击率 +2%',
    rule:{ id:'action', name:'超距', desc:'普攻也能吃到弱点加成的一半。', line:'场不需要接触，就能起作用。' },
    stats:{ critAdd:0.02 },
    sources:[
      { type:'book', id:'dianci', note:'变化的磁场生出电流' },
      { type:'book', id:'tongyi', note:'把引力与电磁写成同一件事' },
      { type:'card', id:'c3', note:'牛顿手稿里那张不属于那个世纪的纸' },
      { type:'card', id:'c4', note:'让磁场转起来' },
      { type:'combo', id:'induction', note:'感应风暴' },
    ],
  },
  {
    id:'conservation', name:'守恒', icon:'⚖️',
    line:'东西不会凭空出现，也不会凭空消失 —— 它只是换了地方，或者换了形态。整座现代科学的第一步，就是学会记账。',
    bonusText:'书页产出 +6%',
    rule:{ id:'carry', name:'转移', desc:'溢出的伤害有 10% 结转到下一场的第一击。', line:'它没有消失，只是去了别处。' },
    stats:{ pageMul:0.06 },
    sources:[
      { type:'book', id:'zhiliang', note:'烧完之后一毫克都没少' },
      { type:'book', id:'ranshao', note:'把燃烧从玄学变成称重' },
      { type:'card', id:'c18', note:'一毫克' },
      { type:'card', id:'c19', note:'最后一次实验' },
      { type:'combo', id:'perpetual', note:'热力学第一定律' },
    ],
  },
  {
    id:'uncertainty', name:'不确定性', icon:'🎲',
    line:'你越精确地知道它在哪，就越不知道它要去哪。这不是仪器不够好，是世界本来的样子。',
    bonusText:'暴击伤害 +4%',
    rule:{ id:'fluct', name:'测不准', desc:'你的伤害在 0.92 ~ 1.08 倍之间浮动。', line:'测得越准，另一样就越不准。' },
    stats:{ critDmg:0.04 },
    sources:[
      { type:'book', id:'cebuzhun', note:'位置与动量不可兼得' },
      { type:'book', id:'yueqian', note:'不经过中间地带' },
      { type:'card', id:'c16', note:'盒子里的猫' },
      { type:'card', id:'c17', note:'不看时月亮在哪' },
      { type:'quirk', id:'leap', note:'玻尔的「跃迁」' },
    ],
  },
  {
    id:'light', name:'光的本性', icon:'💡',
    line:'它是波还是粒子？这场争论持续了三百年，最后的答案是：你问它是波，它就是波；你问它是粒子，它就是粒子。',
    bonusText:'命中弱点时额外 +4%',
    rule:{ id:'duality', name:'二象', desc:'每场随机取「波」或「粒」：波 → 暴击率 +4%；粒 → 暴击伤害 +8%。', line:'没测量之前，两种都是真的。' },
    stats:{ affAdd:0.04 },
    sources:[
      { type:'book', id:'guangxingcha', note:'恒星位置的偏移' },
      { type:'book', id:'bodong', note:'光是一种振动' },
      { type:'card', id:'c14', note:'阴影中心的那个亮点' },
      { type:'sig', id:'sigNoAberration', note:'牛顿反射镜的「消色差」' },
      { type:'combo', id:'dualism', note:'波粒二象性' },
    ],
  },
  {
    id:'number', name:'数论', icon:'🔢',
    line:'关于整数的一些看起来毫无用处的规律。它们花了两千年才被认真对待，然后成了你今天每一次网购背后的锁。',
    bonusText:'暴击伤害 +4%',
    rule:{ id:'discrete', name:'整除', desc:'每第 10 次命中，该次伤害 ×1.5。', line:'数到整数，就跳一格。' },
    stats:{ critDmg:0.04 },
    sources:[
      { type:'book', id:'tongyu', note:'模 n 的世界' },
      { type:'book', id:'suanshu', note:'七章重铺数论地基' },
      { type:'combo', id:'formalize', note:'形式化：换一个模数' },
    ],
  },
  {
    id:'infinity', name:'无穷', icon:'∞',
    line:'无限多项相加，可以是一个有限的数。这句话说完，人类才第一次真正追上芝诺的乌龟。',
    bonusText:'洞见产出 +3%',
    rule:{ id:'approach', name:'逼近', desc:'战斗每过 10 秒，伤害 +2%（最多 +14%）。', line:'永远到不了，但可以一直靠近。' },
    stats:{ rateEq:0.03 },
    sources:[
      { type:'book', id:'jixian', note:'无限地靠近' },
      { type:'book', id:'wuqiongxiao', note:'欧拉把无穷小当成一个数' },
      { type:'card', id:'c9', note:'无王者之路' },
    ],
  },
  {
    id:'value', name:'价值', icon:'💵',
    line:'东西值多少钱，不由它包含多少劳动决定，而由别人愿意为它付多少决定。这句话一旦成立，泡沫就有了理论依据。',
    bonusText:'范式获取 +2%',
    rule:{ id:'division', name:'分工', desc:'强化书籍时的书页消耗 -5%。', line:'省下来的那些，是别人替你做的。' },
    stats:{ paraEq:0.02 },
    sources:[
      { type:'book', id:'guofu', note:'看不见的手' },
      { type:'book', id:'tonglun', note:'需求不足时市场不会自己恢复' },
      { type:'book', id:'nanhai', note:'一张纸涨了十倍又跌回去' },
      { type:'sig', id:'sigThought', note:'爱因斯坦烟斗的「思想实验」' },
    ],
  },
  {
    id:'doubt', name:'怀疑', icon:'🕳️',
    line:'把一切可疑的都扔掉，直到剩下那个不能怀疑的东西。这不是虚无，是给知识找一个不会被推倒的地基。',
    bonusText:'受到伤害 -2%',
    rule:{ id:'suspend', name:'悬置', desc:'开场 3 秒内，你受到的第一次伤害 -25%。', line:'先不下判断，本身也是一种判断。' },
    stats:{ dmgCut:0.02 },
    sources:[
      { type:'book', id:'chensi', note:'我思故我在' },
      { type:'book', id:'chuncui', note:'为信仰留出地盘' },
      { type:'book', id:'lixiangguo', note:'洞穴里的影子' },
      { type:'quirk', id:'blind', note:'笛卡尔的「蔽障」' },
    ],
  },
];

/* ============================================================
   原典装备的专属能力（签名）
   ------------------------------------------------------------
   只有六件「史诗」有。它们不是更高的数值，而是一条别人没有的规则 ——
   对应那个人一生里最特别的一件事。名字负责让你记住，效果负责让你改打法，
   how 负责让你想再去查一下。
   ============================================================ */
const EQUIP_SIGNATURE = {
  'pen:5': {
    id:'sigTrajectory', name:'弹道计算', icon:'📐',
    desc:'普通攻击有 20% 概率造成 3 倍伤害。',
    how:'伽利略设计的军用圆规不只能画圆，还能算炮弹落点。在没有微积分的年代，这就是把抛物线算准的方法。',
  },
  'paper:5': {
    id:'sigPrincipia', name:'公理化', icon:'📜',
    desc:'所有技能伤害 +18%，但技能冷却 +10%。',
    how:'《原理》用三条公理推演整座宇宙。代价是：一旦接受这套公理，你就得按它的规矩走——严密，但慢。',
  },
  'mirror:5': {
    id:'sigNoAberration', name:'消色差', icon:'🔭',
    desc:'暴击伤害从 1.8 倍提升到 2.5 倍。',
    how:'透镜会把不同颜色的光分开，所以成像总带一圈彩边。牛顿干脆不用透镜，改用反射镜——色差被绕开了，而不是被修正。',
  },
  'lamp:5': {
    id:'sigRetry', name:'第一千次', icon:'💡',
    desc:'技能释放后有 12% 概率立刻再释放一次。',
    how:'爱迪生试了上千种灯丝材料才找到碳化的棉线。他的原话是：我没有失败，我只是找到了一千种不行的方法。',
  },
  'robe:5': {
    id:'sigBeyond', name:'时间之外', icon:'🕰️',
    desc:'每场战斗免疫一次致命伤害，并回复 30% 生命。',
    how:'霍金 21 岁被判定只剩两年。他活到了 76 岁，还在那两年之后的五十多年里写完了《时间简史》。',
  },
  'seal:5': {
    id:'sigThought', name:'思想实验', icon:'💭',
    desc:'范式转移获得的点数 +25%。',
    how:'爱因斯坦十六岁就想：如果我追着一束光跑，会看到什么？这个他从没做过的实验，最后长成了相对论。',
  },
};

/* 每件顶级装备的一句来历 —— 在图鉴和掉落时露出来 */
const EQUIP_LORE = {
  'pen:5':    '伽利略设计的圆规不只能画圆，还能算炮弹的弹道。它同时是几何工具和军用计算尺。',
  'paper:5':  '《原理》的手稿并不整齐，边角全是改到看不清的算式。哈雷是看完这堆纸才决定掏钱出版的。',
  'mirror:5': '牛顿为了避开色差，干脆不用透镜，改用一面凹面镜聚光——反射望远镜就是这么来的。',
  'lamp:5':   '爱迪生试了上千种灯丝材料才找到碳化的棉线。他说：我没有失败，我只是找到了一千种不行的方法。',
  'robe:5':   '霍金 21 岁被诊断只能再活两年。那把轮椅陪他又过了五十多年，还替他说话。',
  'seal:5':   '爱因斯坦的烟斗几乎从不离手。他说，抽烟斗能让人「有耐心地把一个问题想到底」。',
  'pen:4':    '图灵在布莱切利园用铅笔在纸上推演，纸比机器快——因为纸可以随时擦掉重来。',
  'paper:4':  '第谷二十年如一日记录火星位置，精度达到 1 角分。开普勒就是靠这些数字推翻了圆轨道。',
  'mirror:4': '列文虎克自己磨的单透镜能放大 270 倍，比同时代的正规显微镜还清楚。他第一个看见了细菌。',
  'lamp:4':   '戴维的矿灯用金属网罩住火焰：热被网带走，烧不到外面的瓦斯。它救了几代矿工的命。',
  'robe:4':   '拉瓦锡做燃烧实验时穿着围裙、戴着面罩。他死于政治，不是死于实验。',
  'seal:4':   '牛顿当过皇家学会会长。他用这个身份做的最出名的一件事，是把胡克的画像从学会里撤掉。',
};

/* ----------------------------------------------------------
   词条池
   kind: num 数值型（直接进 stats）/ rule 规则型（改行为）
   num 词条用 stat + val；val 是「每件装备累加一次」
   ---------------------------------------------------------- */
const AFFIXES = [
  /* 笔 —— 技能冷却 */
  { id:'pen_cd',      slot:'pen', kind:'num',  stat:'cdMul',   val:-0.05, name:'快笔',   desc:'技能冷却 -5%' },
  { id:'pen_cd2',     slot:'pen', kind:'num',  stat:'cdMul',   val:-0.09, name:'疾书',   desc:'技能冷却 -9%' },
  { id:'pen_skill',   slot:'pen', kind:'num',  stat:'ampEq',   val:0.06,  name:'着力',   desc:'技能伤害 +6%' },
  { id:'pen_link',    slot:'pen', kind:'num',  stat:'linkAdd', val:0.03,  name:'连贯',   desc:'同行相邻加成 +3%' },
  { id:'pen_first',   slot:'pen', kind:'rule', rule:'firstCast', name:'起手', desc:'战斗前 8 秒冷却 -30%' },
  { id:'pen_kill',    slot:'pen', kind:'rule', rule:'killReset',  name:'接续', desc:'击杀后立即重置全部冷却' },
  { id:'pen_silence', slot:'pen', kind:'rule', rule:'silenceRun', name:'默书', desc:'沉默期间冷却继续推进' },

  /* 纸 —— 书页掉率 */
  { id:'paper_drop',  slot:'paper', kind:'num',  stat:'pageMul', val:0.10, name:'厚册', desc:'书页掉落 +10%' },
  { id:'paper_drop2', slot:'paper', kind:'num',  stat:'pageMul', val:0.18, name:'充栋', desc:'书页掉落 +18%' },
  { id:'paper_up',    slot:'paper', kind:'num',  stat:'costMul', val:-0.06, name:'节省', desc:'升级与升阶成本 -6%' },
  { id:'paper_rate',  slot:'paper', kind:'num',  stat:'rateEq',  val:0.08, name:'速读', desc:'洞见产出 +8%' },
  { id:'paper_double',slot:'paper', kind:'rule', rule:'firstDouble', name:'初版', desc:'每个关卡首通书页翻倍' },
  { id:'paper_eqdrop',slot:'paper', kind:'rule', rule:'equipDrop',   name:'拾遗', desc:'装备掉落概率 +4 个百分点' },
  { id:'paper_off',   slot:'paper', kind:'num',  stat:'offlineEq', val:0.10, name:'备忘', desc:'离线收益 +10%' },

  /* 镜 —— 暴击与相性 */
  { id:'mir_crit',    slot:'mirror', kind:'num',  stat:'critAdd', val:0.03, name:'锐目', desc:'暴击率 +3%' },
  { id:'mir_crit2',   slot:'mirror', kind:'num',  stat:'critAdd', val:0.06, name:'洞见', desc:'暴击率 +6%' },
  { id:'mir_critdmg', slot:'mirror', kind:'num',  stat:'critDmg', val:0.20, name:'重击', desc:'暴击伤害倍率 +0.2' },
  { id:'mir_aff',     slot:'mirror', kind:'num',  stat:'affAdd',  val:0.04, name:'通晓', desc:'克制倍率 +0.04' },
  { id:'mir_nores',   slot:'mirror', kind:'rule', rule:'noResist',  name:'无视', desc:'被抗时不再承受 0.8 惩罚' },
  { id:'mir_critauto',slot:'mirror', kind:'rule', rule:'critAuto',  name:'连击', desc:'暴击时额外触发一次普攻' },
  { id:'mir_bench',   slot:'mirror', kind:'rule', rule:'benchBonus',name:'满架', desc:'每本未上桌的书，技能伤害 +2%' },

  /* 灯 —— 洞见产出 */
  { id:'lamp_rate',   slot:'lamp', kind:'num',  stat:'rateEq', val:0.12, name:'长明', desc:'洞见产出 +12%' },
  { id:'lamp_rate2',  slot:'lamp', kind:'num',  stat:'rateEq', val:0.22, name:'彻夜', desc:'洞见产出 +22%' },
  { id:'lamp_ins',    slot:'lamp', kind:'num',  stat:'attrIns', val:3,   name:'启明', desc:'悟性 +3' },
  { id:'lamp_off',    slot:'lamp', kind:'num',  stat:'offlineEq', val:0.15, name:'守夜', desc:'离线收益 +15%' },
  { id:'lamp_offcap', slot:'lamp', kind:'rule', rule:'offlineCap', name:'不寐', desc:'离线收益上限 8 小时 → 12 小时' },
  { id:'lamp_idle',   slot:'lamp', kind:'num',  stat:'rateEq',  val:0.09, name:'静思', desc:'洞见产出 +9%' },
  { id:'lamp_para',   slot:'lamp', kind:'num',  stat:'paraEq',  val:3,    name:'照见', desc:'范式获取 +3%' },

  /* 袍 —— 生命与减伤 */
  { id:'robe_hp',     slot:'robe', kind:'num',  stat:'hpAdd',  val:60,   name:'厚衬', desc:'生命上限 +60' },
  { id:'robe_hp2',    slot:'robe', kind:'num',  stat:'hpAdd',  val:130,  name:'重袍', desc:'生命上限 +130' },
  { id:'robe_rigor',  slot:'robe', kind:'num',  stat:'attrRigor', val:3, name:'端方', desc:'严谨 +3' },
  { id:'robe_guard',  slot:'robe', kind:'num',  stat:'dmgCut', val:0.05, name:'护持', desc:'受到伤害 -5%' },
  { id:'robe_low',    slot:'robe', kind:'rule', rule:'lowHp',    name:'坚韧', desc:'生命低于 30% 时受伤 -50%' },
  { id:'robe_reflect',slot:'robe', kind:'rule', rule:'alwaysReflect', name:'反照', desc:'反弹效果常驻（45% 强度）' },
  { id:'robe_time',   slot:'robe', kind:'num',  stat:'timeAdd', val:5,    name:'耐久', desc:'单场战斗限时 +5 秒' },

  /* 印 —— 范式与转生 */
  { id:'seal_para',   slot:'seal', kind:'num',  stat:'paraEq', val:5,    name:'铭刻', desc:'范式获取 +5%' },
  { id:'seal_para2',  slot:'seal', kind:'num',  stat:'paraEq', val:9,    name:'铸印', desc:'范式获取 +9%' },
  { id:'seal_bonus',  slot:'seal', kind:'num',  stat:'paraAmp',val:0.01, name:'传承', desc:'每点范式加成 +1%' },
  { id:'seal_keep',   slot:'seal', kind:'rule', rule:'keepPage', name:'不焚', desc:'范式转移时书页全部保留而非一半' },
  { id:'seal_keepbook',slot:'seal',kind:'rule', rule:'keepBook', name:'不烬', desc:'范式转移时书籍等级保留一半' },
  { id:'seal_god',    slot:'seal', kind:'num',  stat:'godDmg', val:0.15, name:'僭越', desc:'对理念之神的伤害 +15%' },
  { id:'seal_era',    slot:'seal', kind:'num',  stat:'eraCut', val:0.08, name:'守成', desc:'纪元强度增幅 -8%' },
];

/* 掉落：普通关 / 精英 / Boss
   v0.6：三件合一的长线让「每一件」都很值钱，所以总量必须收紧 ——
   原来一轮 480 关能掉 107 件、其中 89% 是原典，装备直接失去了意义。
   Boss 不再必掉（首通保底见 winBattle），重复刷的收益砍半。 */
const EQUIP_DROP = { normal:0.055, elite:0.18, boss:0.55 };

/* 熔解：多余的装备换回书页。
   数值刻意压得比「书升阶」便宜很多 —— 它是清库房的出口，不是赚钱的路子。 */
const EQUIP_MELT_PAGE = [6, 15, 34, 75, 165, 400];

/* 掉落的品质随关卡推进而提升，但永远不「必给最高档」。
   v0.6 改动：
     ① 删掉 eraFloor —— 转生不该凭空白送两档品质（这是满级装备泛滥的元凶）；
     ② 中心档降到 3，围绕它做三角抖动 —— 顶级只可能在深关 Boss 手上出现；
     ③ 普通关再低 0.9 档，让「清杂兵」和「打 Boss」掉的东西拉开距离。
   结果：一轮 480 关约 60 件，原典 8 件上下 —— 凑齐 6 个槽位仍然要规划。 */
function equipQualityFor(stageIdx, kind) {
  /* 品质曲线按「前 8 个学派的跨度」封顶，而不是按总关卡数：
     学派可以无限加，但史诗不该因此变得越来越稀有。 */
  const span = Math.min(SCHOOLS.length, 8) * STAGES_PER_SCHOOL;
  const p = Math.max(0, Math.min(1, stageIdx / Math.max(1, span - 1)));
  let center = 3.0 * p;
  if (kind === 'boss') center += 1.5;
  else if (kind === 'normal') center -= 0.9;
  /* 三角抖动 ±1.3 档：两端收敛，中心最常见 */
  const r = (Math.random() + Math.random() - 1) * 1.3;
  return Math.max(0, Math.min(QUALITIES.length - 1, Math.round(center + r)));
}

/* ============================================================
   精英怪癖：24 个有名有姓的人，一人一条规则
   ------------------------------------------------------------
   机制是通用的（thorns/dilute/blind…），但 note 写这个人为什么这样，
   p 是这个人专属的参数 —— 同样是「稀释」，伽利略和欧拉的上限并不一样。
   ============================================================ */
const ELITE_QUIRKS = {
  mechanics: [
    { id:'dilute', note:'他把自由落体摊到一条缓坡上——再大的力被拉长、摊薄，也就没那么疼了。', p:{ cap:0.065 } },
    { id:'thorns', note:'「形变有多大，回弹就有多大。」这是他自己写下的定律，现在用在你身上。', p:{ back:0.34 } },
    { id:'blind',  note:'他连自己的眼睛都不信，你怎么可能瞄准他的要害？', p:{} },
  ],
  electric: [
    { id:'ramp',   note:'你每施放一次技能，都在给他充电。他靠「变化的磁场」吃饭。', p:{ every:5, growth:0.10 } },
    { id:'spike',  note:'电流攒够了就一次放出来。他量的是安培，不是伏特。', p:{ every:10, mult:2.6 } },
    { id:'shrug',  note:'电磁波没有实体，打不中是常态，打中才是意外。', p:{ chance:0.26 } },
  ],
  formal: [
    { id:'dilute', note:'无穷多项相加，每一项都小到可以忽略——但他有无限项。', p:{ cap:0.085 } },
    { id:'blind',  note:'极端值会被拉回中间。你的暴击在他眼里只是噪声。', p:{} },
    { id:'shrug',  note:'空间是弯的，你的攻击走不出直线。', p:{ chance:0.20 } },
  ],
  natural: [
    { id:'decay',  note:'他给每本书都编了号。你重复用同一本，他就提前知道该怎么接。', p:{ step:0.14, max:0.65 } },
    { id:'dilute', note:'三十六卷博物志，你打的那一下只够写进其中一页的注脚。', p:{ cap:0.055 } },
    { id:'spike',  note:'他相信物种是被一次次灾变抹掉的——现在轮到你被抹。', p:{ every:13, mult:2.8 } },
  ],
  thermal: [
    { id:'ramp',   note:'你做的每一份功，最后都变成了他的热。', p:{ every:5, growth:0.11 } },
    { id:'entropy',note:'不可逆。他研究的东西本来就不会倒回去。', p:{ every:9, growth:0.14 } },
    { id:'shrug',  note:'单个分子无法预测，但整体一定服从统计——他对你也是如此。', p:{ chance:0.24 } },
  ],
  optic: [
    { id:'spike',  note:'整个波前同时到达，那就是一次冲击。', p:{ every:11, mult:2.5 } },
    { id:'blind',  note:'两束光叠在一起可以互相抵消——他把你的暴击也抵消了。', p:{} },
    { id:'shrug',  note:'方向不对的光，根本过不去。', p:{ chance:0.28 } },
  ],
  quantum: [
    { id:'dilute', note:'你越想精确地打中他，他的位置就越模糊。', p:{ cap:0.05 } },
    { id:'shrug',  note:'在打开盒子之前，打中的和没打中的是同一件事。', p:{ chance:0.30 } },
    { id:'drain',  note:'你的每一分伤害，都对应一份反的东西——而那份反的归他。', p:{ rate:0.34 } },
  ],
  chem: [
    { id:'ramp',   note:'他发现的正是那种让火越烧越旺的气。', p:{ every:6, growth:0.09 } },
    { id:'spike',  note:'闻起来像成功，其实有毒。', p:{ every:12, mult:2.3 } },
    { id:'dilute', note:'原子不可分——再大的力，也只能停在最外面那一层。', p:{ cap:0.07 } },
  ],
};

/* ============================================================
   书籍组合（COMBO）
   ------------------------------------------------------------
   两本特定的书同时放在书桌上，就会「反应」出第三条规则。
   组合不是数值叠加，而是把两个学科交叉处的东西拿出来用 ——
   这也是这套系统最有教育意味的地方：知识真正的力量长在边界上。

   kind: 'active' 定时主动释放
         'passive' 常驻规则，挂在战斗结算里
   ============================================================ */
const COMBOS = [
  {
    id: 'railgun', name: '超电磁炮', icon: '💥',
    need: ['luolunzi', 'luoti'],
    tagline: '两条平行的导轨，通上一股电流，中间那颗弹丸会自己飞出去。',
    how: '洛伦兹力 F = qv×B 永远垂直于速度，所以它不加速、只拐弯；真正把弹丸推出去的是安培力。两个公式凑在一起，就是电磁轨道炮。',
    effect: '每 8 秒发射一枚弹丸：攻击 ×3.2，无视抗性。附带：桌面上的力系/运动系书伤害 +15%。',
    kind: 'active', cd: 8, mult: 3.2, ignoreResist: true, boostTag: ['force','motion'], boost: 0.15,
  },
  {
    id: 'dualism', name: '波粒二象性', icon: '🌗',
    need: ['bodong', 'yueqian'],
    tagline: '你测它是波，它就是波；你测它是粒子，它就是粒子。',
    how: '双缝实验里，光同时表现出干涉条纹（波）和单点落痕（粒）。这不是观测手段不够好，而是它本来就没有一个「先于测量」的形态。',
    effect: '每 6 秒切换形态：波态打 3 段，粒态单发 2.5 倍。附带：暴击率 +5%。',
    kind: 'active', cd: 6, mult: 2.5, critAdd: 0.05,
  },
  {
    id: 'induction', name: '感应风暴', icon: '🌩️',
    need: ['dianci', 'xianquan'],
    tagline: '变化的磁场生出电流，而电流又生出磁场——它能自己喂自己。',
    how: '法拉第发现「变化的磁场产生电流」，麦克斯韦补上另一半：「变化的电场产生磁场」。两句话合起来，电磁波就能在真空里自己走下去。',
    effect: '每 9 秒全场放电，并让敌人沉默 2 秒。附带：全部技能冷却 -5%。',
    kind: 'active', cd: 9, mult: 1.5, silence: 2, cdCut: 0.05,
  },
  {
    id: 'perpetual', name: '热力学第一定律', icon: '♻️',
    need: ['reqixunhuan', 'zhiliang'],
    tagline: '能量不会凭空产生，也不会凭空消失——它只是换了个地方待着。',
    how: '卡诺循环让热变成功，拉瓦锡的天平让物质守恒。两条定律合起来说的是同一件事：账要平。所以一次施放的能量，可以再回到下一次施放里。',
    effect: '技能释放后有 30% 概率不进入冷却。',
    kind: 'passive', recycle: 0.30,
  },
  {
    id: 'redqueen', name: '红皇后', icon: '🏃',
    need: ['qiyuan', 'ziranshenxue'],
    tagline: '你必须拼命奔跑，才能留在原地。',
    how: '《物种起源》讲的是变异与选择，《自然神学》讲的是一个设计好的世界。把两者放在一起，得到的是「军备竞赛」：猎豹越快，羚羊也必须越快，谁都没有真的赢。',
    effect: '每 10 秒，双方攻击都 +10%（可叠加）。',
    kind: 'passive', every: 10, growth: 0.10,
  },
  {
    id: 'bubble', name: '泡沫经济', icon: '🫧',
    need: ['tonglun', 'nanhai'],
    tagline: '所有人都知道它是泡沫，但所有人都相信自己能在破裂前跑掉。',
    how: '凯恩斯说需求不足时市场不会自己恢复；南海泡沫则证明，市场在过度乐观时也不会自己刹车。这两件事加起来，就是周期。',
    effect: '每次命中，有 20% 概率触发崩盘：你损失 5% 当前生命，敌人损失 15% 最大生命。',
    kind: 'passive', chance: 0.20, selfCost: 0.05, foeCost: 0.15,
  },
  {
    id: 'formalize', name: '形式化', icon: '📐',
    need: ['digongshe', 'tongyu'],
    tagline: '把「例外」写成一条新公理，例外就不再是例外。',
    how: '两千年里没人能证明第五公设，于是有人干脆假设它不成立——非欧几何就此诞生。同余则告诉你，只要换一个模数，原本不相等的东西也能归为一类。两个动作是同一个：重写规则。',
    effect: '无视敌人 30% 的减伤与抗性惩罚。',
    kind: 'passive', pierce: 0.30,
  },
];

/* ============================================================
   学派名人怪癖分配
   ------------------------------------------------------------
   eliteQuirk / bossQuirk 挂到每一轮的精英与 BOSS 身上（同一学派三轮共用一种风格）。
   bossWeakExtra[轮次] 是额外弱点：只对具体的人成立，不对「自然现象」成立。
   例：牛顿晚年沉迷神学、把身家赔进南海泡沫 —— 所以宗教与金融打他更疼。
   ============================================================ */
const SCHOOL_QUIRKS = {
  mechanics: { elite: ELITE_QUIRKS.mechanics,    boss:'bubble',  bossWeakExtra:[ null, ['finance'], ['theology','finance'] ] },
  electric:  { elite: ELITE_QUIRKS.electric,  boss:'overdue', bossWeakExtra:[ null, null, ['finance'] ] },
  formal:    { elite: ELITE_QUIRKS.formal,  boss:'dogma',   bossWeakExtra:[ null, null, ['philosophy'] ] },
  natural:   { elite: ELITE_QUIRKS.natural,    boss:'falsify', bossWeakExtra:[ null, ['theology'], null ] },
  thermal:   { elite: ELITE_QUIRKS.thermal, boss:'entropy', bossWeakExtra:[ null, null, null ] },
  optic:     { elite: ELITE_QUIRKS.optic,  boss:'ether',   bossWeakExtra:[ null, null, ['philosophy'] ] },
  quantum:   { elite: ELITE_QUIRKS.quantum,   boss:'leap',    bossWeakExtra:[ null, ['philosophy'], null ] },
  chem:      { elite: ELITE_QUIRKS.chem,    boss:'balance', bossWeakExtra:[ null, null, ['finance'] ] },
};
SCHOOLS.forEach(s => {
  const q = SCHOOL_QUIRKS[s.id];
  if (!q) return;
  s.eliteQuirks = q.elite;
  s.bossQuirk = q.boss;
  s.bossWeakExtra = q.bossWeakExtra;
});

/* ---- 人对人的学科：书籍掉落挂到对应关卡 ---- */
[ [22,'chanhui'], [27,'lixiangguo'], [39,'chensi'], [51,'guofu'],
  [75,'shangdicheng'], [87,'chuncui'], [99,'ziranshenxue'],
  [123,'tonglun'], [183,'nanhai'] ].forEach(([k, id]) => {
  const arr = STAGE_DROPS[k] || (STAGE_DROPS[k] = []);
  if (!arr.some(x => x.id === id)) arr.push({ id, chance: 1 });
});

/* ==========================================================
   成就系统 —— 图鉴第 6 页
   奖励只给书页 + 洞见，不给范式点（避免扰动转生通胀曲线）
   hrs = 领取时按当前洞见产出折算的小时数（随进度自动保值）
   ========================================================== */
const ACH_CATS = {
  progress: '学派之路',
  collect:  '收藏家',
  battle:   '战斗纪念',
  prestige: '纪元与范式',
  concept:  '通晓者',
};

/* ==========================================================
   研究课题 —— 范式的去处
   ----------------------------------------------------------
   背景：玩家手里攒着 3000+ 点范式，而天赋点满只要 25 点 —— 转生货币等于死钱。
   「范式」本来的意思是「你看世界的方式」，所以它最该花在「选择研究什么」上，
   而不是买数值。课题 = 花范式立项 + 达成条件结题 + 拿走永久结论。
   need 的类型在 game.js 的 researchProgress() 里判定，reward 由 researchBonus() 汇总。
   ========================================================== */
const RESEARCH_SLOTS = 2;   /* 同时能进行几个课题 */

const RESEARCH = [
  /* ---- 入门：让玩家第一次知道范式能干嘛 ---- */
  { id:'r_open',   name:'开卷',  cost:5,  tier:1,
    need:{ t:'books', n:10 },
    reward:{ rate:0.10 },
    line:'先有书，才有研究。把书架填满十本，才知道自己缺什么。' },
  { id:'r_collate',name:'校勘',  cost:8,  tier:1,
    need:{ t:'bookLv', n:5, lv:30 },
    reward:{ page:0.10 },
    line:'同一段话抄一百遍，抄到第三十遍时你会开始怀疑原文。这就是校勘。' },
  { id:'r_break',  name:'破壁',  cost:12, tier:1,
    need:{ t:'stage', n:48 },
    reward:{ atk:0.15 },
    line:'一个学派走到底，撞上那堵墙，然后翻过去。' },
  { id:'r_nature', name:'博物',  cost:15, tier:1,
    need:{ t:'books', n:20 },
    reward:{ hp:0.20 },
    line:'布丰写了三十六卷，林奈给万物编号。收集本身就是一种方法。' },

  /* ---- 进阶：要玩家真的去碰那些没玩过的系统 ---- */
  { id:'r_truth',  name:'辨伪',  cost:30, tier:2,
    need:{ t:'debunk', n:3 },
    reward:{ amp:0.15 },
    line:'识破三条曾被当成真理的东西。知道什么错，比知道什么对更难。' },
  { id:'r_lens',   name:'显微',  cost:40, tier:2,
    need:{ t:'concept', n:3 },
    reward:{ slot:1 },
    line:'列文虎克磨了一辈子镜片。看得见的东西多了，能同时想的事也多了。' },
  { id:'r_edge',   name:'淬锋',  cost:50, tier:2,
    need:{ t:'equipQ', q:4, n:3 },
    reward:{ critDmg:0.25 },
    line:'三件孤本。器物不会让你更聪明，但会让你出手更重。' },
  { id:'r_trace',  name:'溯源',  cost:45, tier:2,
    need:{ t:'cards', n:8 },
    reward:{ cd:-0.08 },
    line:'八张知识卡拼起来，是一条没人告诉过你的时间线。' },
  { id:'r_dive',   name:'下潜',  cost:60, tier:2,
    need:{ t:'abyss', n:20 },
    reward:{ abyss:0.50 },
    line:'深渊没有底。下到第二十层你会明白，它考的不是强度，是耐心。' },

  /* ---- 精深：长线，吃下大头范式 ---- */
  { id:'r_shift',  name:'范式革命', cost:150, tier:3,
    need:{ t:'prestige', n:5 },
    reward:{ rate:0.50 },
    line:'库恩说，科学不是累积的，是被推翻的。转生五次，你该懂这句话了。' },
  { id:'r_all',    name:'集大成',   cost:220, tier:3,
    need:{ t:'books', n:40 },
    reward:{ desk:1 },
    line:'四十本书摊在桌上，你终于能同时听见好几个人的声音。' },
  { id:'r_gewu',   name:'格物',    cost:300, tier:3,
    need:{ t:'stage', n:300 },
    reward:{ amp:0.40 },
    line:'格物致知。不是盯着竹子看七天，是把三百关的规律一条条记下来。' },
  { id:'r_connect',name:'贯通',    cost:400, tier:3,
    need:{ t:'combo', n:6 },
    reward:{ dmgCut:0.10, critDmg:0.30 },
    line:'六组书放在一起才发生的事，说明知识本来就不是一本一本存在的。' },
];

const RESEARCH_TIER_NAME = { 1:'入门', 2:'进阶', 3:'精深' };
const RESEARCH_NEED_TEXT = {
  books:  r => `拥有 ${r.n} 本书`,
  bookLv: r => `${r.n} 本书升到 Lv${r.lv}`,
  stage:  r => `最高关卡达到 ${r.n}`,
  debunk: r => `识破 ${r.n} 条被推翻的解释`,
  concept:r => `通晓 ${r.n} 个概念`,
  equipQ: r => `拥有 ${r.n} 件「${QUALITIES[r.q].grade}」以上装备`,
  cards:  r => `收集 ${r.n} 张知识卡`,
  abyss:  r => `深渊下潜到第 ${r.n} 层`,
  prestige:r=> `完成 ${r.n} 次范式转移`,
  combo:  r => `发现 ${r.n} 组书籍组合`,
};
const RESEARCH_REWARD_TEXT = {
  rate:   v => `洞见产出 +${Math.round(v * 100)}%`,
  page:   v => `书页掉落 +${Math.round(v * 100)}%`,
  atk:    v => `攻击 +${Math.round(v * 100)}%`,
  hp:     v => `生命 +${Math.round(v * 100)}%`,
  amp:    v => `技能伤害 +${Math.round(v * 100)}%`,
  cd:     v => `技能冷却 ${v < 0 ? '-' : '+'}${Math.round(Math.abs(v) * 100)}%`,
  critDmg:v => `暴击伤害 +${Math.round(v * 100)}%`,
  dmgCut: v => `减伤 +${Math.round(v * 100)}%`,
  abyss:  v => `深渊书页 +${Math.round(v * 100)}%`,
  desk:   v => `书桌 +${v} 槽`,
  slot:   v => `概念印记 +${v} 槽`,
};

const ACHIEVEMENTS = [
  /* ---- 学派之路 ---- */
  { id:'st5',    cat:'progress', icon:'🚪', name:'初窥门径',   desc:'推进到第 5 关',          page:60,   hrs:0.5, check:s => s.maxStage >= 5 },
  { id:'st25',   cat:'progress', icon:'🧭', name:'渐入佳境',   desc:'推进到第 25 关',         page:180,  hrs:1,   check:s => s.maxStage >= 25 },
  { id:'st60',   cat:'progress', icon:'🏔️', name:'半山之上',   desc:'推进到第 60 关',         page:500,  hrs:1.5, check:s => s.maxStage >= 60 },
  { id:'st120',  cat:'progress', icon:'🌋', name:'深水区',     desc:'推进到第 120 关',        page:1600, hrs:2,   check:s => s.maxStage >= 120 },
  { id:'st192',  cat:'progress', icon:'👑', name:'走到尽头',   desc:'走完全部关卡的最后一个 BOSS', page:6000, hrs:4,   check:s => s.maxStage >= SCHOOLS.length * STAGES_PER_SCHOOL },

  /* ---- 收藏家 ---- */
  { id:'bk10',   cat:'collect',  icon:'📚', name:'小藏书家',   desc:'拥有 10 本书',           page:120,  hrs:0.5, check:s => Object.keys(s.books).length >= 10 },
  { id:'bk25',   cat:'collect',  icon:'📚', name:'大藏书家',   desc:'拥有 25 本书',           page:500,  hrs:1,   check:s => Object.keys(s.books).length >= 25 },
  { id:'bkall',  cat:'collect',  icon:'🏛️', name:'博尔赫斯之梦', desc:'集齐全部书籍',          page:3000, hrs:3,   check:s => BOOKS.every(b => s.books[b.id]) },
  { id:'cd10',   cat:'collect',  icon:'🃏', name:'拾遗',       desc:'收集 10 张知识卡',       page:300,  hrs:1,   check:s => (s.cards||[]).length >= 10 },
  { id:'cdall',  cat:'collect',  icon:'🃏', name:'全图鉴',     desc:'收集全部知识卡',         page:2500, hrs:3,   check:s => CARDS.every(c => (s.cards||[]).includes(c.id)) },
  { id:'cb3',    cat:'collect',  icon:'✦',  name:'化学反应',   desc:'发现 3 个书籍组合',      page:350,  hrs:1,   check:s => (s.comboSeen||[]).length >= 3 },
  { id:'cball',  cat:'collect',  icon:'✦',  name:'全部配方',   desc:'发现全部书籍组合',       page:2000, hrs:2,   check:s => (s.comboSeen||[]).length >= COMBOS.length },
  { id:'eq5',    cat:'collect',  icon:'🖋️', name:'原典在手',   desc:'获得一件原典品质装备',   page:1500, hrs:2,
    check:s => (s.bag||[]).some(e => e.q === 5) || Object.values(s.equip||{}).some(e => e && e.q === 5) },
  { id:'eqsig',  cat:'collect',  icon:'✨', name:'名物有灵',   desc:'穿戴一件带专属能力的装备', page:800, hrs:1,
    check:s => Object.values(s.equip||{}).some(e => e && hasSignature(e)) },
  { id:'hog',    cat:'collect',  icon:'🐷', name:'冷门经典',   desc:'获得《母猪的产后护理》',  page:666, hrs:1,
    check:s => !!s.books['mugou'] },

  /* ---- 战斗纪念 ---- */
  { id:'fail10', cat:'battle',   icon:'🩹', name:'退回来，也是路', desc:'累计战败 10 次',      page:200,  hrs:1,   check:s => (s.fails||0) >= 10 },
  { id:'qk10',   cat:'battle',   icon:'🎭', name:'见过世面',   desc:'遇到 10 种人物怪癖',     page:300,  hrs:1,   check:s => (s.quirkSeen||[]).length >= 10 },
  { id:'qk20',   cat:'battle',   icon:'🎭', name:'阅人无数',   desc:'遇到 20 种人物怪癖',     page:1200, hrs:2,   check:s => (s.quirkSeen||[]).length >= 20 },
  { id:'god1',   cat:'battle',   icon:'👁', name:'不可说服者', desc:'首次击败理念之神',       page:1000, hrs:2,   check:s => (s.godKills||0) >= 1 },
  { id:'god5',   cat:'battle',   icon:'👁', name:'第五形态',   desc:'击败理念之神 5 次',      page:4000, hrs:3,   check:s => (s.godKills||0) >= 5 },

  /* ---- 纪元与范式 ---- */
  { id:'pg1',    cat:'prestige', icon:'🔄', name:'范式转移',   desc:'完成第一次范式转移',     page:300,  hrs:1,   check:s => (s.prestigeCount||0) >= 1 },
  { id:'pg5',    cat:'prestige', icon:'🔁', name:'旧世界再见', desc:'完成 5 次范式转移',      page:900,  hrs:1.5, check:s => (s.prestigeCount||0) >= 5 },
  { id:'pg15',   cat:'prestige', icon:'♾️', name:'革命的革命', desc:'完成 15 次范式转移',     page:3000, hrs:3,   check:s => (s.prestigeCount||0) >= 15 },
  { id:'era5',   cat:'prestige', icon:'🕰️', name:'第五纪元',   desc:'抵达第 5 纪元',          page:1500, hrs:2,   check:s => (s.era||1) >= 5 },
  { id:'era10',  cat:'prestige', icon:'🕰️', name:'第十纪元',   desc:'抵达第 10 纪元',         page:4500, hrs:3,   check:s => (s.era||1) >= 10 },

  /* ---- 通晓者 ---- */
  { id:'cn1',    cat:'concept',  icon:'💡', name:'第一道化学反应', desc:'完全通晓 1 个概念',  page:150,  hrs:0.5,
    check:() => Object.values(conceptProgress()).filter(p => p.pct >= 1).length >= 1 },
  { id:'cn5',    cat:'concept',  icon:'💡', name:'融会',       desc:'完全通晓 5 个概念',      page:800,  hrs:1.5,
    check:() => Object.values(conceptProgress()).filter(p => p.pct >= 1).length >= 5 },
  { id:'cnall',  cat:'concept',  icon:'🌌', name:'贯通',       desc:'完全通晓全部概念',       page:5000, hrs:4,
    check:() => Object.values(conceptProgress()).filter(p => p.pct >= 1).length >= CONCEPTS.length },
  { id:'mark7',  cat:'concept',  icon:'📌', name:'七枚印记',   desc:'印记槽位扩展到 7 个',    page:2000, hrs:2,   check:() => conceptSlots() >= 7 },
  { id:'off10',  cat:'concept',  icon:'🌙', name:'守夜人',     desc:'领取 10 次离线奖励',     page:1000, hrs:2,   check:s => (s.offlineCount||0) >= 10 },
];

/* ==========================================================
   己方单位（Unit）—— P0 地基
   ------------------------------------------------------------
   召唤物不再是「自动掉血的计时器」，而是有血量、会被敌人打、
   会被治疗、会死掉的实体。医学（治疗）、墨家（造物+非攻反伤）、
   博物（生物种群）三个学派全部建在这块地基上。
   ========================================================== */
const UNIT_TYPES = {
  /* 守护：血厚、承伤多、输出低 —— 墨家机关的样子 */
  guard:  { name:'守护', icon:'🛡️', hpRatio:0.55, dmgRatio:0.40, intercept:0.60, life:14, burst:0.8 },
  /* 攻击：血薄、输出高、几乎不承伤 */
  strike: { name:'攻击', icon:'⚔️', hpRatio:0.30, dmgRatio:1.00, intercept:0.20, life:12, burst:0.6 },
  /* 群体：个体很弱、数量多，靠「繁殖」和「数量」取胜 */
  swarm:  { name:'群体', icon:'🐝', hpRatio:0.18, dmgRatio:0.55, intercept:0.10, life:12, burst:0.3 },
};

const UNIT_LIMIT = 5;            /* 场上最多 5 个己方单位 */
const UNIT_DPS_CAP = 0.60;       /* 红线：召唤物总 DPS ≤ 本体的 60% */
const UNIT_REFLECT_CAP = 0.08;   /* 红线：反伤 ≤ 玩家最大生命 8%/次 */

/* 非攻：只要场上有存活的己方单位，敌人打「你」也会被反弹。
   默认 0 —— 这是 P1 墨家学派才会点亮的规则，地基先留好接口。 */
const NONAGGRESSION = { reflect: 0 };

/* ==========================================================
   P1：机巧学派（墨子）—— 第九学派
   ------------------------------------------------------------
   方法论「归纳」：墨家重实测、重器械、重"能不能真的挡住"。
   机制核心：造物（带血量的机关）+ 非攻（机关在场时，打我也反弹）。
   ========================================================== */
SCHOOLS.push({
  id:'craft', name:'机巧学派', short:'机巧', doctrine:'归纳', mult:3200000,
  blueprint:[
    { n:'木鸢',   e:'🪁', weak:'force',  resist:'motion', k:'normal' },
    { n:'连弩',   e:'🏹', weak:'logic',  resist:'force',  k:'normal' },
    { n:'云梯',   e:'🪜', weak:'motion', resist:'logic',  k:'normal' },
    { n:'精英',   e:'🛠️', weak:'logic',  resist:'field',  k:'elite'  },
    { n:'守城械', e:'🏯', weak:'field',  resist:'motion', k:'normal' },
    { n:'司南',   e:'🧭', weak:'motion', resist:'field',  k:'normal' },
    { n:'小孔',   e:'🕳️', weak:'force',  resist:'logic',  k:'normal' },
    { n:'BOSS',   e:'⚙️', weak:'motion', resist:'force',  k:'boss'   },
  ],
  elites:['公输班', '张衡', '沈括'],
  bosses:['墨子', '墨子 · 非攻', '墨子 · 兼爱'],
  bossLines:[
    '「你解下腰带当城墙，我攻了九次。现在换你攻我。」',
    '「非攻不是不战 —— 是让你打不动。」',
    '「兼相爱，交相利。你要拿走的东西，本来就不该只属于你。」',
  ],
  epitaphs:[
    '「兼相爱，交相利。」——《墨子·兼爱中》',
    '「备者，国之重也。」——《墨子·七患》',
    '「志不强者智不达。」——《墨子·修身》',
  ],
  rare:{ id:'mengxi', chance:0.04 },
});

ELITE_QUIRKS.craft = [
  { id:'thorns', note:'他造的云梯能把守城的石块弹回去 —— 你打他，等于替他试器械。', p:{ back:0.30 } },
  { id:'spike',  note:'地动仪不会一直响。它蓄够了势，才会在某一刻动起来。', p:{} },
  { id:'decay',  note:'《梦溪笔谈》里写满了"旧法不可复用" —— 同一招用第二遍，他就知道怎么拆。', p:{} },
];

/* 学派 quirks 的 forEach 在上面已经跑过了，这里单独补第九学派 */
{
  const c = SCHOOLS.find(s => s.id === 'craft');
  c.eliteQuirks = ELITE_QUIRKS.craft;
  c.bossQuirk = 'drain';                 /* 兼爱：把你的伤害收走一部分，还给自己 */
  c.bossWeakExtra = [null, ['philosophy'], ['finance']];
}

BOOKS.push(
  {
    id:'kaogongji', name:'考工记', emoji:'📐', type:'attr', q:0, rate:0.48, school:'craft',
    attr:{rigor:7, fortitude:2, intuition:3, precision:2},
    desc:'"匠人营国，方九里，旁三门。"中国最早的手工业技术总集，把"怎么做才对"写成了标准。',
    quote:'"国有六职，百工与居一焉。"',
    source:'第 9 学派 · 第 1 轮精英（公输班）',
  },
  {
    id:'tiangong', name:'天工开物', emoji:'⚙️', type:'skill', q:0, rate:0.52, school:'craft',
    tag:'force', cd:9, mult:0.62, effect:'summon', unit:'strike', unitCount:1,
    desc:'宋应星把稻、盐、铁、纸的做法一样样画下来。召唤一台水力机械入场，替你输出 12 秒。',
    quote:'"贵五谷而贱金玉。"',
    source:'第 9 学派 · 第 2 轮精英（张衡）',
  },
  {
    id:'shoucheng', name:'备城门', emoji:'🏯', type:'skill', q:0, rate:0.30, school:'craft',
    tag:'logic', cd:12, mult:0.35, effect:'summon', unit:'guard', unitCount:1, unitReflect:0.12,
    desc:'《墨子》里守城的十一条。召唤一座带血量的守城械：它替你承伤，被打时会反弹伤害。',
    quote:'"备者，国之重也。"',
    source:'第 9 学派 · 墨经首杀',
  },
  {
    id:'feigong', name:'非攻', emoji:'🛡️', type:'skill', q:0, rate:0.26, school:'craft',
    tag:'philosophy', cd:11, mult:0.30, effect:'guard', unitReflect:0.18,
    desc:'不是不战，是让你打不动。场上只要有己方单位，敌人对你的攻击就会被反弹一部分。',
    quote:'"今有一人，入人园圃，窃其桃李……"——《墨子·非攻上》',
    source:'第 9 学派 · 第 3 轮 BOSS 首杀（墨子）',
  },
  {
    id:'xiaokong', name:'小孔成像', emoji:'🕳️', type:'attr', q:0, rate:0.40, school:'craft',
    attr:{insight:8, intuition:4, precision:3},
    desc:'"景到，在午有端，与景长，说在端。"《墨经》用八个字说清了光的直线传播 —— 比西方早约两千年。',
    quote:'"景，光之人，煦若射。"',
    source:'第 9 学派 · 第 3 轮精英（沈括）',
  },
  {
    id:'mengxi', name:'梦溪笔谈', emoji:'📜', type:'attr', q:0, rate:0.85, school:'craft',
    attr:{insight:9, rigor:6, fortitude:1, intuition:5, precision:4, eloquence:5, celerity:1},
    desc:'沈括被贬后写的笔记：活字印刷、石油命名、磁偏角、地质分层 —— 一个人记下了一个时代的技术。',
    quote:'"予奉使河北，边太行而北……"',
    source:'第 9 学派 · 稀有掉落',
  },
  /* ---------- 博物学派：种群召唤（P1） ---------- */
  {
    id:'renkoulun', name:'人口论', emoji:'👥', type:'skill', q:0, rate:0.34, school:'natural',
    tag:'life', cd:12, mult:0.40, effect:'summon', unit:'swarm', unitCount:2, grow:6,
    desc:'马尔萨斯说人口按几何级数增长，食物按算术级数增长。召唤一个会自我复制的种群 —— 每 6 秒多一只，直到撞上环境容纳量。',
    quote:'"人口若不受到抑制，将以几何级数增长。"',
    source:'博物学派 · 第 3 轮精英（布丰）',
  },
  {
    id:'shengtawei', name:'生态位理论', emoji:'🪹', type:'attr', q:0, rate:0.55, school:'natural',
    attr:{insight:7, rigor:5, fortitude:1},
    desc:'同一个地方，不同的鸟吃不同的东西、在不同的高度筑巢 —— 它们不是在抢位置，是在各自的"位"里活着。',
    quote:'"没有两个物种能长期占据同一个生态位。"',
    source:'博物学派 · 稀有掉落',
  },
);

CARDS.push({
  id:'c20', boss:199, title:'腰带做的城墙',
  text:'公输班攻了九次，墨子守了九次。最后他说：我的弟子三百人已经拿着我的器械，在宋国的城墙上等你们了。楚王于是收兵。——一场没打起来的战争，靠的是演练过。',
});

/* 新书掉落挂到关卡 */
[ [195,'kaogongji'], [199,'feigong'], [203,'tiangong'],
  [207,'shoucheng'], [211,'xiaokong'],
  [83,'renkoulun'], [91,'shengtawei'] ].forEach(([k, id]) => {
  const arr = STAGE_DROPS[k] || (STAGE_DROPS[k] = []);
  if (!arr.some(x => x.id === id)) arr.push({ id, chance: 1 });
});

/* 非攻光环上限：书桌最多叠到 30% */
const UNIT_REFLECT_AURA_CAP = 0.30;

/* ==========================================================
   P2–P4：补齐克制环的其余十一学派
   ------------------------------------------------------------
   原则：一个学派 = 一个新动词。属性/数值/关卡全部复用现有循环，
   只有"玩家多做的那件事"是新的。
   ========================================================== */

/* 关卡模板：8 关固定节奏，weak/resist 按位置轮转，避免 11 份样板 */
const BP_PATTERN = [
  ['force','motion'], ['logic','force'], ['motion','logic'], ['logic','field'],
  ['field','motion'], ['motion','field'], ['force','logic'], ['motion','force'],
];
function mkSchool(o) {
  const blueprint = o.stages.map(([n, e], i) => {
    const p = BP_PATTERN[i];
    const k = i === 3 ? 'elite' : i === 7 ? 'boss' : 'normal';
    return { n: k === 'elite' ? '精英' : k === 'boss' ? 'BOSS' : n, e, weak: p[0], resist: p[1], k };
  });
  return {
    id: o.id, name: o.name, short: o.short, doctrine: o.doctrine, mult: o.mult,
    blueprint, elites: o.elites, bosses: o.bosses,
    bossLines: o.lines, epitaphs: o.epitaphs, rare: o.rare || null,
    eliteQuirks: o.eliteQuirks, bossQuirk: o.bossQuirk, bossWeakExtra: o.bossWeakExtra || [null, null, null],
  };
}

SCHOOLS.push(
  mkSchool({
    id:'medicine', name:'医学学派', short:'医学', doctrine:'归纳', mult:6400000,
    stages:[['伤寒','🤒'],['炎症','🔥'],['解剖','🫀'],['[E]','🩺'],['麻醉','💉'],['疫苗','🧪'],['脉象','💓'],['[B]','⚕️']],
    elites:['盖伦','维萨里','巴斯德'], bosses:['哈维','哈维 · 血液循环','哈维 · 心血运动'],
    lines:['「血不是一潭死水。你们放了两千年，放的是同一个错误。」','「它绕一圈又回来了——你看，这才是活着。」','「测量它。别相信任何权威，包括我。」'],
    epitaphs:['「血液在体内循环，周而复始。」——《心血运动论》','「我宁愿相信解剖刀，也不愿相信盖伦。」','「医学的进步，从承认自己错了开始。」'],
    rare:{ id:'tiwen', chance:0.04 },
    eliteQuirks:[
      { id:'drain', note:'盖伦的学说靠"权威"活着——你打得越狠，他越能自圆其说。', p:{} },
      { id:'dilute', note:'维萨里一层层解剖下去，把伤害摊薄在每一层组织里。', p:{ cap:0.07 } },
      { id:'decay', note:'巴斯德的疫苗讲"同一招不能重复用"——第二次他就免疫了。', p:{} },
    ],
    bossQuirk:'compound', bossWeakExtra:[null, ['philosophy'], ['finance']],
  }),
  mkSchool({
    id:'cognition', name:'认知学派', short:'认知', doctrine:'先验', mult:12800000,
    stages:[['错觉','🌀'],['预期','👁'],['盲点','🕳️'],['[E]','🧠'],['范畴','🗂️'],['统觉','🪞'],['物自体','🌑'],['[B]','👤']],
    elites:['休谟','莱布尼茨','冯特'], bosses:['康德','康德 · 先天综合','康德 · 物自体'],
    lines:['「你看见的秩序，有一半是你自己带进来的。」','「因果不是世界给的，是你非要这么看。」','「物自体在那里。你永远碰不到它。」'],
    epitaphs:['「人为自然立法。」','「有两样东西，越思考越敬畏：头顶的星空与心中的道德律。」','「要有勇气运用你自己的理性。」'],
    rare:{ id:'yizhi', chance:0.04 },
    eliteQuirks:[
      { id:'blind', note:'休谟说因果只是习惯——你以为的"暴击"，可能只是联想。', p:{} },
      { id:'shrug', note:'莱布尼茨算过所有可能世界，包括你这一击打空的那个。', p:{} },
      { id:'spike', note:'冯特在实验室里计时你的反应，等到某一刻才按下去。', p:{} },
    ],
    bossQuirk:'falsify', bossWeakExtra:[null, null, ['theology']],
  }),
  mkSchool({
    id:'info', name:'信息学派', short:'信息', doctrine:'计算', mult:25600000,
    stages:[['纸带','📜'],['编码','🔢'],['状态机','🔁'],['[E]','💾'],['停机','⏹'],['噪声','📡'],['通用机','🖥️'],['[B]','🧮']],
    elites:['香农','冯·诺依曼','图灵机'], bosses:['图灵','图灵 · 判定问题','图灵 · 停机'],
    lines:['「机器能思考吗？这个问题本身就是答案的一部分。」','「有些问题，永远算不出答案——不是不够聪明。」','「我可以模拟任何一台机器，包括你。」'],
    epitaphs:['「我们只能看到前方很短的一段，但能看到那里有太多事等着被做。」','「信息是不确定性的减少。」','「一台机器能做的事，另一台也能做——只要给它足够的纸带。」'],
    rare:{ id:'kongzhilun', chance:0.04 },
    eliteQuirks:[
      { id:'decay', note:'香农说重复的符号不含信息——你第二遍用同一本书，他就读不出威胁。', p:{} },
      { id:'shrug', note:'冯·诺依曼的博弈论里，你的每一次出手都在他的概率表里。', p:{} },
      { id:'overdue', note:'图灵机的纸带被往后推了一格——你的技能总慢半拍。', p:{} },
    ],
    bossQuirk:'overdue', bossWeakExtra:[null, ['philosophy'], null],
  }),
  mkSchool({
    id:'law', name:'法学学派', short:'法学', doctrine:'演绎', mult:51000000,
    stages:[['契约','📜'],['判例','⚖️'],['证据','🔍'],['[E]','🏛️'],['程序','📋'],['主权','👑'],['解释','📖'],['[B]','⚖️']],
    elites:['格劳秀斯','边沁','萨维尼'], bosses:['孟德斯鸠','孟德斯鸠 · 三权','孟德斯鸠 · 法的精神'],
    lines:['「一切有权力的人都容易滥用权力，直到遇到界限。」','「用权力约束权力——这不是理想，是设计。」','「法不是命令，是让命令变得可以预期。」'],
    epitaphs:['「一切有权力的人都容易滥用权力。」——《论法的精神》','「法的目的是自由。」','「徒法不足以自行。」'],
    rare:{ id:'shehuqiyue', chance:0.04 },
    eliteQuirks:[
      { id:'dogma', note:'格劳秀斯把自然法写成了不容置疑的前提——同源的书对他无效。', p:{} },
      { id:'balance', note:'边沁算最大多数人的最大幸福——你的每一次攻击都被他折算成功利。', p:{} },
      { id:'dilute', note:'萨维尼说法律是长出来的，不是造出来的——伤害被他摊进历史里。', p:{} },
    ],
    bossQuirk:'dogma', bossWeakExtra:[null, ['philosophy'], ['finance']],
  }),
  mkSchool({
    id:'econ', name:'经济学派', short:'经济', doctrine:'计算', mult:102000000,
    stages:[['供需','📈'],['价格','🏷️'],['分工','🔧'],['[E]','💰'],['周期','📉'],['货币','🪙'],['看不见的手','🤲'],['[B]','📊']],
    elites:['配第','李嘉图','马歇尔'], bosses:['亚当·斯密','亚当·斯密 · 分工','亚当·斯密 · 看不见的手'],
    lines:['「我们每天所需的食料，不是来自屠夫的仁慈。」','「一只看不见的手，把私利导向了公共善——你不必感谢它。」','「市场能定价一切，包括你的时间。」'],
    epitaphs:['「我们的晚餐并非来自屠夫、酿酒师和面包师的恩惠。」','「分工是国民财富的最大进步。」','「消费是一切生产的唯一目的。」'],
    rare:{ id:'huobilun', chance:0.04 },
    eliteQuirks:[
      { id:'compound', note:'配第说土地是财富之母——他的力量按复利滚，你得抢时间。', p:{} },
      { id:'entropy', note:'李嘉图的地租越涨越凶——拖得越久，双方都更疼。', p:{} },
      { id:'ramp', note:'马歇尔的均衡价格在动：他的攻击随时间一路爬升。', p:{} },
    ],
    bossQuirk:'compound', bossWeakExtra:[null, ['philosophy'], ['theology']],
  }),
  mkSchool({
    id:'lingua', name:'语言学派', short:'语言', doctrine:'诠释', mult:205000000,
    stages:[['音位','🔊'],['词','📝'],['句法','🧩'],['[E]','🗣️'],['隐喻','🎭'],['能指','🔗'],['所指','💭'],['[B]','📚']],
    elites:['洪堡','雅各布森','乔姆斯基'], bosses:['索绪尔','索绪尔 · 能指','索绪尔 · 差异'],
    lines:['「不是你给它命名，是命名让你看见它。」','「意义不在词里，在词与词的差别里。」','「语言不是世界的影子，是世界的边界。」'],
    epitaphs:['「语言是一个纯粹价值的系统。」','「在语言中，只有差异，没有正项。」','「语言的界限，就是世界的界限。」'],
    rare:{ id:'jufajiegou', chance:0.04 },
    eliteQuirks:[
      { id:'shrug', note:'洪堡说每种语言都是一种世界观——你的攻击被翻译成了他听得懂的方言。', p:{} },
      { id:'blind', note:'雅各布森拆解你的技能：发送者、信息、通道——他只看通道。', p:{} },
      { id:'decay', note:'乔姆斯基的生成语法：同一个句子说第二遍，就不再是"新信息"。', p:{} },
    ],
    bossQuirk:'ether', bossWeakExtra:[null, ['philosophy'], null],
  }),
  mkSchool({
    id:'astro', name:'天文学派', short:'天文', doctrine:'演绎', mult:410000000,
    stages:[['本轮','🪐'],['轨道','⭕'],['相位','🌗'],['[E]','🔭'],['视差','📐'],['周期','⏳'],['椭圆','🥚'],['[B]','🌌']],
    elites:['喜帕恰斯','第谷','伽利略·天文'], bosses:['开普勒','开普勒 · 轨道','开普勒 · 周期'],
    lines:['「圆是最完美的形状——所以你们的行星都不老实。」','「行星走的不是圆，是椭圆。美不美不重要，准才重要。」','「周期与距离，有一个固定的比例。你们管它叫定律。」'],
    epitaphs:['「我思上帝之所思。」','「我不建造体系，我只是测量。」','「自然爱简单，也爱精确。」'],
    rare:{ id:'xintianwenxue', chance:0.04 },
    eliteQuirks:[
      { id:'spike', note:'喜帕恰斯的本轮一圈套一圈，蓄够了才动一下。', p:{} },
      { id:'ramp', note:'第谷记了二十年的数据——他的攻击精确到每一秒都在涨。', p:{} },
      { id:'dilute', note:'伽利略把望远镜对准了你，把伤害摊在整片星场上。', p:{ cap:0.07 } },
    ],
    bossQuirk:'leap', bossWeakExtra:[null, ['philosophy'], ['theology']],
  }),
  mkSchool({
    id:'geo', name:'地质学派', short:'地质', doctrine:'归纳', mult:820000000,
    stages:[['层理','🪨'],['化石','🦴'],['侵蚀','🌊'],['[E]','⛏️'],['断层','↔️'],['岩浆','🌋'],['深时','⏳'],['[B]','🏔️']],
    elites:['赫顿','居维叶','史密斯'], bosses:['莱伊尔','莱伊尔 · 均变','莱伊尔 · 深时'],
    lines:['「你以为这是灾难的遗迹？不，这是每天都在发生的事，只是你活得不够久。」','「现在，是过去的钥匙。」','「一亿年不需要奇迹，只需要耐心。」'],
    epitaphs:['「现在是认识过去的钥匙。」——《地质学原理》','「地质学家的时间，比历史学家长得多。」','「山不是被造出来的，是被削出来的。」'],
    rare:{ id:'diqiudelilun', chance:0.04 },
    eliteQuirks:[
      { id:'thorns', note:'赫顿说地层是循环的——你打进去的力，会从另一头挤回来。', p:{ back:0.30 } },
      { id:'dilute', note:'居维叶看见的是灾变，其实是缓慢的堆积——伤害被摊进几千年。', p:{ cap:0.06 } },
      { id:'shrug', note:'史密斯靠化石给地层排序：你的招数一旦被"定性"，就失效了。', p:{} },
    ],
    bossQuirk:'entropy', bossWeakExtra:[null, null, ['theology']],
  }),
  mkSchool({
    id:'eco', name:'生态学派', short:'生态', doctrine:'归纳', mult:1640000000,
    stages:[['食物链','🔗'],['共生','🤝'],['竞争','⚔️'],['[E]','🌱'],['演替','🌳'],['容纳量','📉'],['循环','♻️'],['[B]','🌍']],
    elites:['怀特','奥德姆','卡逊'], bosses:['博洛格','博洛格 · 绿色革命','博洛格 · 容纳量'],
    lines:['「没有谁能独自活下来。包括你。」','「你以为你在打一个敌人，其实你在扰动一整个系统。」','「产量可以翻倍，但土地不会。」'],
    epitaphs:['「万物相连。」','「人类第一次有能力改变整个生物圈。」——《寂静的春天》','「给一个人一条鱼，他吃一天；教他养鱼，他改了整个湖。」'],
    rare:{ id:'jijing', chance:0.04 },
    eliteQuirks:[
      { id:'ramp', note:'怀特笔下的生态在缓慢演替——他的强度随战斗时间一路累积。', p:{} },
      { id:'drain', note:'奥德姆的能量流动图：你的伤害有一部分被系统"循环"回了他身上。', p:{} },
      { id:'decay', note:'卡逊写道，反复喷同一种药只会造出抗药性——重复的招式会失效。', p:{} },
    ],
    bossQuirk:'falsify', bossWeakExtra:[null, ['finance'], null],
  }),
  mkSchool({
    id:'strat', name:'战略学派', short:'战略', doctrine:'计算', mult:3300000000,
    stages:[['庙算','🗺️'],['粮道','🍚'],['地形','⛰️'],['[E]','🏕️'],['奇正','🌀'],['情报','🕵️'],['不战','🕊️'],['[B]','⚔️']],
    elites:['孙膑','吴起','克劳塞维茨'], bosses:['孙子','孙子 · 庙算','孙子 · 不战'],
    lines:['「你还没开打，就已经输了——因为我在庙里算过。」','「兵者，诡道也。你以为的正面，是我留给你的。」','「百战百胜，非善之善者也。」'],
    epitaphs:['「知彼知己，百战不殆。」','「上兵伐谋，其次伐交。」','「兵无常势，水无常形。」'],
    rare:{ id:'zhanzhenglun', chance:0.04 },
    eliteQuirks:[
      { id:'blind', note:'孙膑减灶诱敌——你看到的兵数，是他让你看到的。', p:{} },
      { id:'spike', note:'吴起与士卒同衣食，等士气蓄满才一击。', p:{} },
      { id:'shrug', note:'克劳塞维茨说战争是迷雾——你的命中在他那里本来就是概率。', p:{} },
    ],
    bossQuirk:'balance', bossWeakExtra:[null, ['finance'], ['philosophy']],
  }),
  mkSchool({
    id:'music', name:'音乐学派', short:'音乐', doctrine:'先验', mult:6600000000,
    stages:[['音程','🎵'],['节奏','🥁'],['和声','🎹'],['[E]','🎼'],['对位','🧵'],['调性','🎷'],['共鸣','🔔'],['[B]','🎻']],
    elites:['毕达哥拉斯','扎利诺','拉莫'], bosses:['巴赫','巴赫 · 赋格','巴赫 · 平均律'],
    lines:['「你以为这是声音？这是比例。」','「一条旋律可以同时有五条命——只要它们彼此让路。」','「把八度切成十二份，每一份都稍微不准。这才是能转调的代价。」'],
    epitaphs:['「音乐是数学的听觉显现。」','「凡有比例处，皆有和谐。」','「平均律不是完美，是可用。」'],
    rare:{ id:'pingjunlv', chance:0.04 },
    eliteQuirks:[
      { id:'balance', note:'毕达哥拉斯用弦长比例衡量一切——多一分则不和。', p:{} },
      { id:'dogma', note:'扎利诺把"正确"的和声写成了规则，同源的书打不进去。', p:{} },
      { id:'spike', note:'拉莫的和声进行要蓄到解决的那一拍才落。', p:{} },
    ],
    bossQuirk:'ether', bossWeakExtra:[null, ['philosophy'], null],
  }),
);

/* ---- 11 个学派的书（每学派 2 技能 + 1 属性，一个技能 = 一个新动词） ---- */
BOOKS.push(
  /* 医学 */
  { id:'xinxue', name:'心血运动论', emoji:'🫀', type:'skill', q:0, rate:0.30, school:'medicine',
    tag:'life', cd:9, mult:0.0, effect:'heal',
    desc:'哈维用绷带和测量证明血液在体内循环。施放时回复自身生命，并把一半分给己方单位。',
    quote:'"血不是涌出去就消失了，它绕一圈回来了。"', source:'第 10 学派 · 哈维首杀' },
  { id:'lunchuanran', name:'论传染', emoji:'🧫', type:'skill', q:0, rate:0.30, school:'medicine',
    tag:'life', cd:14, mult:0.0, effect:'heal',
    desc:'疾病不是瘴气，是活的微生物。群体救治：给场上所有己方单位回血，自身回少量。',
    quote:'"看不见的东西，正在杀死你们。"', source:'第 10 学派 · 第 2 轮精英（巴斯德）' },
  { id:'tiwen', name:'体温与代谢', emoji:'🌡️', type:'attr', q:0, rate:0.55, school:'medicine',
    attr:{rigor:6, fortitude:2, insight:6},
    desc:'把"活着"量化为可测的数字：温度、脉搏、耗氧。医学第一次开始怀疑权威。',
    quote:'"测量，然后才敢下结论。"', source:'第 10 学派 · 稀有掉落' },

  /* 认知 */
  { id:'gestalt', name:'格式塔心理学原理', emoji:'🧠', type:'skill', q:0, rate:0.32, school:'cognition',
    tag:'field', cd:8, mult:0.45, effect:'verify',
    desc:'整体大于部分之和。施放时"校验"面板：看穿虚假数值，随后 3 秒内必定暴击。',
    quote:'"不是元素构成整体，是整体决定了元素的角色。"', source:'第 11 学派 · 第 1 轮精英（冯特）' },
  { id:'yizhi', name:'作为意志和表象的世界', emoji:'🌑', type:'attr', q:0, rate:0.62, school:'cognition',
    attr:{insight:10, intuition:3, precision:3},
    desc:'你看到的世界是表象，驱动它的是意志。这本书让"直觉"第一次压过"严谨"。',
    quote:'"世界是我的表象。"', source:'第 11 学派 · 稀有掉落' },
  { id:'shiyanxinli', name:'实验心理学原理', emoji:'🪞', type:'skill', q:0, rate:0.34, school:'cognition',
    tag:'logic', cd:10, mult:0.55, effect:'verify',
    desc:'把意识搬进实验室，用反应时和阈值说话。校验更长（4 秒），但伤害更低。',
    quote:'"心理学必须先成为一门实验科学。"', source:'第 11 学派 · 康德首杀' },

  /* 信息 */
  { id:'kecaunsuan', name:'论可计算数', emoji:'🧮', type:'skill', q:0, rate:0.28, school:'info',
    tag:'logic', cd:9, mult:0.40, effect:'program',
    desc:'图灵把"计算"定义成一台假想的机器。施放后，若还有其他技能就绪，立刻自动接着放。',
    quote:'"可计算的数，就是一台机器能写出来的数。"', source:'第 12 学派 · 图灵首杀' },
  { id:'kongzhilun', name:'控制论', emoji:'⚙️', type:'attr', q:0, rate:0.70, school:'info',
    attr:{insight:7, rigor:7, fortitude:2, intuition:4, precision:3},
    desc:'反馈回路：输出被送回输入。维纳把机器、生物和社会放在同一个框架里。',
    quote:'"我们不是观察者，我们是回路的一部分。"', source:'第 12 学派 · 稀有掉落' },
  { id:'jiqisiwei', name:'计算机器与智能', emoji:'🖥️', type:'skill', q:0, rate:0.36, school:'info',
    tag:'logic', cd:12, mult:0.60, effect:'program',
    desc:'"机器能思考吗？"施放后自动接续下一发技能，且接续的那一发伤害 +25%。',
    quote:'"我们只能看到前方很短的一段。"', source:'第 12 学派 · 第 3 轮 BOSS（图灵·停机）' },

  /* 法学 */
  { id:'lunfadejingshen', name:'论法的精神', emoji:'⚖️', type:'skill', q:0, rate:0.30, school:'law',
    tag:'philosophy', cd:10, mult:0.35, effect:'precedent',
    desc:'开局立一条判例：攻击 +18% / 受伤 -15% / 暴击 +8%，三选一，本场有效。',
    quote:'"一切有权力的人都容易滥用权力。"', source:'第 13 学派 · 孟德斯鸠首杀' },
  { id:'hanmolabi', name:'汉谟拉比法典', emoji:'🗿', type:'attr', q:0, rate:0.58, school:'law',
    attr:{rigor:7, fortitude:2, eloquence:5, celerity:2},
    desc:'现存最早的成文法之一。条文写的是"如果……那么……"，这是最早的规则化思维。',
    quote:'"以眼还眼，以牙还牙。"', source:'第 13 学派 · 精英掉落' },
  { id:'shehuqiyue', name:'社会契约论', emoji:'📜', type:'skill', q:0, rate:0.33, school:'law',
    tag:'philosophy', cd:12, mult:0.30, effect:'precedent',
    desc:'权力来自被统治者的同意。判例更强（攻击 +25% / 受伤 -20%），但冷却更长。',
    quote:'"人生而自由，却无往不在枷锁之中。"', source:'第 13 学派 · 稀有掉落' },

  /* 经济 */
  { id:'fushui', name:'赋税原理', emoji:'🏷️', type:'skill', q:0, rate:0.32, school:'econ',
    tag:'finance', cd:11, mult:0.42, effect:'pricing',
    desc:'自动花洞见买增益：每 8 秒花掉 3% 洞见，换 10 秒内攻击 +15%。',
    quote:'"地租不是价格的组成部分，而是价格的结果。"', source:'第 14 学派 · 第 2 轮精英（李嘉图）' },
  { id:'jingjixueyuanli', name:'经济学原理', emoji:'📊', type:'attr', q:0, rate:0.68, school:'econ',
    attr:{insight:8, rigor:6, fortitude:1, eloquence:6, celerity:2},
    desc:'供需曲线第一次被画在同一张图上：价格不是被规定的，是被"相遇"决定的。',
    quote:'"供给与需求，像两把剪刀的刀刃。"', source:'第 14 学派 · 第 3 轮精英（马歇尔）' },
  { id:'huobilun', name:'货币论', emoji:'🪙', type:'skill', q:0, rate:0.35, school:'econ',
    tag:'finance', cd:13, mult:0.50, effect:'pricing',
    desc:'货币是流动性的凭证。花洞见更省（2%），换来的加成更久（14 秒）。',
    quote:'"货币是连接现在与未来的桥梁。"', source:'第 14 学派 · 稀有掉落' },

  /* 语言 */
  { id:'putongyuyan', name:'普通语言学教程', emoji:'🗣️', type:'skill', q:0, rate:0.30, school:'lingua',
    tag:'philosophy', cd:9, mult:0.38, effect:'naming',
    desc:'给敌人命名，它就不再是"未知"。命名后 6 秒内无视其抗性。',
    quote:'"在语言中，只有差异，没有正项。"', source:'第 15 学派 · 索绪尔首杀' },
  { id:'yuyanlun', name:'语言论', emoji:'🔗', type:'attr', q:0, rate:0.62, school:'lingua',
    attr:{insight:8, eloquence:7, celerity:2},
    desc:'语言不是思想的衣服，而是思想的形状。换个词，就换了个世界。',
    quote:'"每种语言都是一种世界观。"', source:'第 15 学派 · 精英掉落' },
  { id:'jufajiegou', name:'句法结构', emoji:'🧩', type:'skill', q:0, rate:0.34, school:'lingua',
    tag:'logic', cd:11, mult:0.45, effect:'naming',
    desc:'所有句子底下都有一棵同一形状的树。命名更久（8 秒），伤害略高。',
    quote:'"颜色无色的绿色观念愤怒地睡着。"', source:'第 15 学派 · 稀有掉落' },

  /* 天文 */
  { id:'tiantiyunxing', name:'天体运行论', emoji:'🌌', type:'skill', q:0, rate:0.30, school:'astro',
    tag:'field', cd:7, mult:0.40, effect:'phase',
    desc:'行星在轨道上，相位决定你能看到多少。伤害随 8 秒周期起伏（×0.85 ~ ×1.30）。',
    quote:'"地球在动，而不是天在转。"', source:'第 16 学派 · 第 2 轮精英（第谷）' },
  { id:'xintianwenxue', name:'新天文学', emoji:'🔭', type:'attr', q:0, rate:0.66, school:'astro',
    attr:{insight:9, rigor:6, fortitude:2, intuition:4, precision:3},
    desc:'第谷二十年肉眼观测，开普勒用它算出椭圆——数据比天才更可靠。',
    quote:'"我不建造体系，我只是测量。"', source:'第 16 学派 · 稀有掉落' },
  { id:'hengxinglun', name:'恒星论', emoji:'⭕', type:'skill', q:0, rate:0.33, school:'astro',
    tag:'motion', cd:9, mult:0.48, effect:'phase',
    desc:'周期越长，轨道越远。相位起伏更剧烈（×0.75 ~ ×1.45），赌的是时机。',
    quote:'"周期与距离，有一个固定的比例。"', source:'第 16 学派 · 开普勒首杀' },

  /* 地质 */
  { id:'dizhixueyuanli', name:'地质学原理', emoji:'🏔️', type:'skill', q:0, rate:0.32, school:'geo',
    tag:'field', cd:8, mult:0.30, effect:'sediment',
    desc:'现在是过去的钥匙。伤害不全打出去，而是层积起来，达到阈值后一次爆发。',
    quote:'"现在是认识过去的钥匙。"', source:'第 17 学派 · 莱伊尔首杀' },
  { id:'diqiudelilun', name:'地球的理论', emoji:'🪨', type:'attr', q:0, rate:0.60, school:'geo',
    attr:{rigor:8, fortitude:2, insight:6},
    desc:'赫顿看着不整合的地层说：这里缺了整整一个时代。深时第一次被说出来。',
    quote:'"我们看不到世界的开端，也看不到它的终点。"', source:'第 17 学派 · 精英掉落' },
  { id:'shenshi', name:'深时', emoji:'⏳', type:'skill', q:0, rate:0.35, school:'geo',
    tag:'logic', cd:10, mult:0.26, effect:'sediment',
    desc:'一亿年不需要奇迹，只需要耐心。层积更快，爆发更猛，但单体输出更低。',
    quote:'"时间足够长，一切都可能发生。"', source:'第 17 学派 · 第 3 轮 BOSS（莱伊尔·深时）' },

  /* 生态 */
  { id:'shengtaixue', name:'生态学', emoji:'🌍', type:'skill', q:0, rate:0.32, school:'eco',
    tag:'life', cd:9, mult:0.36, effect:'rotation',
    desc:'轮作：同一块地不能一直种同一种东西。战斗每过 5 秒，伤害 +3%（上限 +18%）。',
    quote:'"万物相连。"', source:'第 18 学派 · 精英掉落' },
  { id:'huanjing', name:'环境容纳量', emoji:'📉', type:'attr', q:0, rate:0.64, school:'eco',
    attr:{insight:8, rigor:6, fortitude:1, intuition:4, precision:4},
    desc:'任何种群的增长都会撞上上限（K 值）。这不是失败，是系统的规则。',
    quote:'"增长总会停下来，问题只是怎么停。"', source:'第 18 学派 · 稀有掉落' },
  { id:'jijing', name:'寂静的春天', emoji:'🦋', type:'skill', q:0, rate:0.34, school:'eco',
    tag:'life', cd:12, mult:0.42, effect:'rotation',
    desc:'一本书让一个国家改变了政策。轮作加成更高（每 5 秒 +4%，上限 +24%），但起步更弱。',
    quote:'"一个没有鸟鸣的春天，不是春天。"', source:'第 18 学派 · 博洛格首杀' },

  /* 战略 */
  { id:'sunzi', name:'孙子兵法', emoji:'⚔️', type:'skill', q:0, rate:0.33, school:'strat',
    tag:'philosophy', cd:8, mult:0.55, effect:'intel',
    desc:'庙算在先：开场 10 秒内伤害 ×1.40。仗在打之前就已经赢了一半。',
    quote:'"知彼知己，百战不殆。"', source:'第 19 学派 · 孙子首杀' },
  { id:'zhanzhenglun', name:'战争论', emoji:'🏕️', type:'attr', q:0, rate:0.66, school:'strat',
    attr:{rigor:6, fortitude:2, eloquence:6, celerity:2, insight:7},
    desc:'战争是政治的延续。克劳塞维茨把"迷雾"写进了理论：你永远不可能知道全部。',
    quote:'"战争是政治的延续，只是换了手段。"', source:'第 19 学派 · 稀有掉落' },
  { id:'zhanzhengyishu', name:'战争艺术', emoji:'🗺️', type:'skill', q:0, rate:0.36, school:'strat',
    tag:'logic', cd:11, mult:0.48, effect:'intel',
    desc:'情报就是优势。开场 14 秒内伤害 ×1.55，之后完全回归常态。',
    quote:'"上兵伐谋，其次伐交。"', source:'第 19 学派 · 第 3 轮 BOSS（孙子·不战）' },

  /* 音乐 */
  { id:'heshengxue', name:'和声学', emoji:'🎹', type:'skill', q:0, rate:0.32, school:'music',
    tag:'field', cd:9, mult:0.44, effect:'chord',
    desc:'两件乐器同时发声才叫和声。若另一个技能已就绪，两者合奏，伤害 +45%。',
    quote:'"和声不是叠加，是让路。"', source:'第 20 学派 · 精英掉落' },
  { id:'yinlv', name:'音律原理', emoji:'🎼', type:'attr', q:0, rate:0.68, school:'music',
    attr:{insight:9, intuition:5, precision:4},
    desc:'八度是 2:1，五度是 3:2。毕达哥拉斯听见的不是声音，是比例。',
    quote:'"音乐是数学的听觉显现。"', source:'第 20 学派 · 稀有掉落' },
  { id:'pingjunlv', name:'平均律', emoji:'🎻', type:'skill', q:0, rate:0.35, school:'music',
    tag:'logic', cd:12, mult:0.40, effect:'chord',
    desc:'把八度切成十二份，每份都稍微不准——换来的是能自由转调。合奏伤害 +35%，但冷却更短。',
    quote:'"平均律不是完美，是可用。"', source:'第 20 学派 · 巴赫首杀' },
);

/* ---- 每个学派一张知识卡（BOSS 关卡 = 学派序 × 24 + 7） ---- */
const CARD_DATA_TAIL = [
  ['c21','医学',223,'同一个错误','盖伦说血液像潮汐一样涨落，两千年没人质疑。哈维只做了一件事：他量了血量。结果发现，心脏一小时泵出的血，超过了人体的总重量——血液只能是在循环。','权威可以统治两千年，一个数字就能终结它。'],
  ['c22','认知',247,'你带进来的','康德说：因果、时间、空间不是世界的属性，而是你戴上的一副眼镜。你永远看不到"没戴眼镜"的世界——那不是限制，那就是"看"本身。','承认自己在解释，比假装客观更诚实。'],
  ['c23','信息',271,'停机','图灵证明了：不存在一台机器，能判断所有程序会不会停下来。这不是技术不够，是逻辑上不可能。有些问题，永远没有答案。','知道自己算不出来，本身就是一个答案。'],
  ['c24','法学',295,'用权力约束权力','孟德斯鸠没有呼吁好人掌权。他说：假设掌权者一定会滥用权力，所以要设计一套让他使不上劲的结构。制度不是为好人设计的，是为"人"设计的。','不要指望人的自觉，要设计不依赖自觉的系统。'],
  ['c25','经济',319,'看不见的手','斯密的意思常被误读成"市场总是对的"。他真正说的是：价格把千万人的分散知识压缩成一个数字，没有人需要知道全部，系统也能协调。','价格是一种信息压缩算法。'],
  ['c26','语言',343,'差异','索绪尔说"牛"这个词的意义不来自牛，而来自它不等于"羊"和"马"。所有意义都建立在差别上——没有正项，只有差异。','你理解的一切，都在关系里。'],
  ['c27','天文',367,'椭圆','开普勒算了几十年圆周运动，误差始终是 8 弧分。他没有把它四舍五入，而是推翻了圆。八弧分，换来一个天文学的新世纪。','不肯妥协的那点误差，才是真相的入口。'],
  ['c28','地质',391,'八弧分的耐心','莱伊尔说：不要用"大洪水"解释地层。那些巨大的岩层，是同一套缓慢的力量，作用了极长的时间。人类历史在它面前，只是一瞬。','你看到的一切，可能只是某个缓慢过程的一帧。'],
  ['c29','生态',415,'没有鸟的春天','卡逊写的不是预言，是调查。DDT 沿食物链富集，最后在鸟的蛋壳里变薄。这本书让一个国家重新定义了"进步"。','一个系统里，没有"外部"。'],
  ['c30','战略',439,'庙算','孙子说：胜利在开战前就决定了。他在庙堂里比较双方的"五事七计"，算完就不用打了。真正的成本，是不知道自己在打什么。','先算，再打；算不过，就别打。'],
  ['c31','音乐',463,'十二分之一','平均律把每个半音都调得"稍微不准"，换来自由转调。巴赫用它写了《平均律键盘曲集》，证明了一个妥协可以开出整个宇宙。','不完美的规则，比完美的例外更有用。'],
];
CARD_DATA_TAIL.forEach(([id, sc, boss, title, text]) => {
  CARDS.push({ id, boss, title, text });
});

/* ---- 新学派的书挂到各自关卡（+3 首本技能书、+11 第二本；属性书走稀有掉落） ---- */
{
  const TAIL_DROPS = [
    ['medicine','xinxue','lunchuanran'], ['cognition','gestalt','shiyanxinli'],
    ['info','kecaunsuan','jiqisiwei'],   ['law','lunfadejingshen','shehuqiyue'],
    ['econ','fushui','huobilun'],        ['lingua','putongyuyan','jufajiegou'],
    ['astro','tiantiyunxing','hengxinglun'], ['geo','dizhixueyuanli','shenshi'],
    ['eco','shengtaixue','jijing'],      ['strat','sunzi','zhanzhengyishu'],
    ['music','heshengxue','pingjunlv'],
  ];
  TAIL_DROPS.forEach(([sid, a, b]) => {
    const si = SCHOOLS.findIndex(s => s.id === sid);
    if (si < 0) return;
    const base = si * STAGES_PER_SCHOOL;
    [[base + 3, a], [base + 11, b]].forEach(([k, id]) => {
      const arr = STAGE_DROPS[k] || (STAGE_DROPS[k] = []);
      if (!arr.some(x => x.id === id)) arr.push({ id, chance: 1 });
    });
  });
}

/* ==========================================================
   书籍详情：内容随品质逐层解锁
   ------------------------------------------------------------
   手抄本只给"简介 + 一句原文"；升阶才读到史实、今天在哪里、
   出处流变、机制解读，最后是原典摘录。
   这既符合"书越珍贵，信息越完整"的直觉，也让升阶有了非数值回报。
   ========================================================== */
const BOOK_TIERS_ORDER = ['手抄本','刊印本','精校本','批注本','孤本','原典'];

/* 效果 → 一句话机制解释（机制解读层用） */
const EFFECT_LABEL = {
  strike:'单体打击', chain:'链式传导', burst:'多段爆发', execute:'处决',
  guard:'减伤护持', reflect:'反弹', dot:'持续伤害', summon:'造物召唤',
  heal:'救治回血', verify:'校验看穿', program:'编排接续', precedent:'立判例',
  pricing:'定价采购', naming:'命名破抗', phase:'相位起伏', sediment:'层积爆发',
  rotation:'轮作递进', intel:'先发压制', chord:'和弦合奏',
};

/* ==========================================================
   错误博物馆 —— 被推翻的解释
   ------------------------------------------------------------
   科学史不是"正确答案的集合"，是"错误被逐个识破"的过程。
   每识破一条，永久 +1% 产出与攻击（上限 +10%）：
   不是奖励"记住错误"，而是奖励"知道它错在哪"。
   ========================================================== */
const DEBUNKED = [
  { id:'phlogiston', icon:'🔥', name:'燃素说', year: 1667, boss: 183,
    wrong:'燃素说认为燃烧是物质放出"燃素"。拉瓦锡称了烧前烧后的总质量，发现增加的重量来自空气——燃素根本不存在。',
    lesson:'一个理论能解释很多现象，也可能从头就错了。' },
  { id:'ether', icon:'🫧', name:'以太', year: 1887, boss: 135,
    wrong:'以太被假定为光传播的介质。迈克尔逊—莫雷实验精度足以测出地球相对以太的运动，结果什么也没测到。',
    lesson:'找不到证据，有时就是证据。' },
  { id:'geocentric', icon:'🌍', name:'地心说', year: 1543, boss: 399,
    wrong:'地心说靠"本轮"一层层修补来拟合观测。哥白尼把太阳放到中心，模型立刻简单得多——但真正的判决来自金星相位与恒星视差。',
    lesson:'一个模型能拟合数据，不代表它描述的是真的。' },
  { id:'bloodletting', icon:'🩸', name:'放血疗法', year: 1799, boss: 231,
    wrong:'放血疗法基于"体液失衡"的假设，统治欧洲两千年。华盛顿在喉咙感染后放了约 2.5 升血，当夜去世。',
    lesson:'权威加上习惯，可以掩盖一个致命错误两千年。' },
  { id:'perpetual', icon:'♾️', name:'永动机', year: 1775, boss: 111,
    wrong:'无数人设计过不需要能量输入的机器。热力学第一、第二定律先后判了它死刑：能量守恒，且熵不可逆。',
    lesson:'知道什么不可能，比知道什么可能有用来得更早。' },
  { id:'phrenology', icon:'🧠', name:'颅相学', year: 1810, boss: 255,
    wrong:'颅相学通过摸头骨的凸起来判断性格与才能，一度非常流行。它的问题不是"观察不仔细"，而是"没有可证伪的预测"。',
    lesson:'看起来科学的东西，可能只是穿了科学的外套。' },
  { id:'canal', icon:'🔭', name:'火星运河', year: 1877, boss: 407,
    wrong:'洛厄尔"看到"了火星上的运河网，并据此推断有文明。后来证明那是望远镜的光学伪影与人眼在模糊边界上的补全。',
    lesson:'你看见的，可能是你的期待替你画上去的。' },
  { id:'mesmer', icon:'🌀', name:'动物磁力', year: 1784, boss: 239,
    wrong:'麦斯麦声称能通过"动物磁力"治病。王室的对照实验让病人面对假树、以为有磁力，结果照样"痊愈"——治愈来自暗示。',
    lesson:'该做的对照实验不做，你永远分不清疗效和信念。' },
  { id:'coldfusion', icon:'⚛️', name:'冷聚变', year: 1989, boss: 191,
    wrong:'两位化学家宣布在室温下实现了核聚变。全球实验室几周内无法复现，最终被判定为测量误差与数据处理问题。',
    lesson:'不能被别人重复的结果，暂时还不能算结果。' },
];

/* 实验机制：同一关挑战到第 3 次，视为"数据充分" */
const EXPERIMENT_NEED = 3;      /* 需要几次才算重复成功 */
const EXPERIMENT_BONUS = 0.10;  /* 数据充分后本场伤害加成 */

/* ==========================================================
   周常世界 BOSS：「遗忘」
   ------------------------------------------------------------
   理念世界由"被记住的东西"构成，遗忘是唯一能侵蚀它的力量。
   每周一个（配置由周号做种子 —— 同一周所有玩家面对同一个它）。
   每周 3 次机会：
     赢 → 书页 + 「记忆强化」（永久 +1% 全局，上限 +10%）
     输 → 书页 -5%、随机一本等级 -1（不低于 1 级）
   惩罚有硬下限：放置游戏的底线是"回来不会变得一无所有"。
   ========================================================== */
const WORLD_BOSS = {
  name: '遗忘',
  emoji: '🕳️',
  title: '理念世界的侵蚀',
  lines: [
    '「你以为你记住了。你只是暂时还没忘。」',
    '「我不是敌人。我是所有敌人的结局。」',
    '「你打赢我一次，我就退回去一点。下周一，我再来。」',
  ],
  hpMul: 2.2,          /* 相对当前关卡 BOSS 的血量倍数 */
  atkMul: 1.15,
  triesPerWeek: 3,
  pageMul: 2.0,        /* 胜利书页 = BOSS 掉落 × 该倍数 */
  losePageCut: 0.95,   /* 失败：书页 ×0.95 */
  memoryPerWin: 1,     /* 每次胜利 +1 点记忆强化 */
  memoryCap: 10,       /* 记忆强化上限 +10% */
  unlockStage: 24,     /* 通关第 1 个学派后开放 */
};

/* ==========================================================
   深渊 —— 480 关之后的无限推层
   ------------------------------------------------------------
   每层 ×1.09：数值上很保守（约 7800 层才碰到 Number 上限），
   但体感很快——100 层就是 5000 倍，200 层是 3000 万倍。
   每 10 层一个守门者，血更厚、带怪癖，作为节奏断点。
   ========================================================== */
const ABYSS = {
  growth: 1.09,       /* 每层血量与攻击的增长倍数 */
  eliteEvery: 10,     /* 每 N 层出现守门者 */
  pagePerDepth: 0.12, /* 书页奖励随深度线性放大 */
  equipEvery: 5,      /* 每 N 层必掉一件装备 */
};

/* ==========================================================
   战斗干预（士气）
   ------------------------------------------------------------
   设计底线：不点也能过。所以手动收益有硬上限——
   一场最多把手动加速折成「战斗限时的 20%」，到顶就不再给。
   ========================================================== */
const MORALE_NEED = 10;        /* 攒满 10 点触发一次 */
const MORALE_CAP_RATIO = 0.20; /* 本场最多加速 = 限时 × 20% */
const MORALE_TAP_MS = 70;      /* 长按连发的最小间隔 */

/* 六种方法论的标识色：书架、书桌、详情三处统一用它，
   让玩家一眼看出"这本书属于哪一环"，而不用点进去查。 */
const DOCTRINE_COLOR = {
  '实证': '#5f9ea0',
  '诠释': '#a874c9',
  '演绎': '#d9a13a',
  '归纳': '#5da86b',
  '先验': '#d06a8a',
  '计算': '#4f8fd9',
};

/* ==========================================================
   早期核心书的学派归属（补齐）
   ------------------------------------------------------------
   游戏最早那批书只写了 tag（学科），没有 school（学派），
   于是 doctrineOf() 一律回落到「实证」——落体定律没问题，
   但《墨经》明明是归纳、《圆锥曲线论》明明是演绎。
   这里按文献事实补上。
   注：已有 book.doctrine 的书优先级更高，不会被 school 覆盖。
   ========================================================== */
const BOOK_SCHOOL_FIX = {
  /* 力学学派 · 实证 */
  luoti: 'mechanics', guanxing: 'mechanics', fanzuoyong: 'mechanics',
  wanyou: 'mechanics', yuanli: 'mechanics', liangmen: 'mechanics', shougao: 'mechanics',
  /* 电气 · 实证 */
  dianci: 'electric', tongyi: 'electric',
  /* 形式 · 演绎 */
  yuanzhui: 'formal', jixian: 'formal', fangfalun: 'formal',
  /* 机巧 · 归纳（墨家本身就是归纳的） */
  mojing: 'craft',
  /* 博物 · 归纳 */
  mugou: 'natural',
  /* 经济 · 计算 */
  guofu: 'econ', tonglun: 'econ', nanhai: 'econ',
  /* 认知 · 先验（康德本人就是认知学派的 BOSS） */
  chuncui: 'cognition',
};
Object.keys(BOOK_SCHOOL_FIX).forEach(id => {
  const b = BOOKS.find(x => x.id === id);
  if (b && !b.school) b.school = BOOK_SCHOOL_FIX[id];
});

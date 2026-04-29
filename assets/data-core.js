// Core Ledger data + scoring functions
// Mirrors the inline script in five-pillar-scorer.html. Exposed as window.CORE.
(function () {
  const W = { quality: .30, durability: .20, growth: .20, valuation: .20, regulatory: .10 };

  const COMPANIES = [
    {t:'NVDA', n:'Nvidia Corporation',         cat:'Magnificent 7',          col:'#76b900',pe:28, roic:94,wacc:11,spread:83,gm:74,gt:'up',  moat:[95,88,72,55],fwdG:38,fcfG:44,fcfY:2.8, peg:0.74,reg:50,cc:0,    vint:0.85,
     note:'Highest quality spread of any company discussed at plus 83 percent. The export controls to China and custom silicon from hyperscalers are present risks. Vintage of 0.85 reflects only three years at this elevated quality level.'},
    {t:'CRDO', n:'Credo Technology',            cat:'AI Infrastructure',      col:'#0d9488',pe:22, roic:77,wacc:25,spread:52,gm:68,gt:'flat',moat:[80,75,70,60],fwdG:50,fcfG:48,fcfY:1.8, peg:1.2, reg:55,cc:0.35, vint:0.55,
     note:'Two hundred percent revenue growth with a fifty-two percent spread. Customer concentration penalty of 1.05 points applied because one buyer represents 35 percent of revenue.'},
    {t:'GOOGL',n:'Alphabet Inc.',               cat:'Magnificent 7',          col:'#0891b2',pe:19, roic:26,wacc:9, spread:17,gm:57,gt:'up',  moat:[78,70,95,40],fwdG:14,fcfG:18,fcfY:4.8, peg:1.36,reg:72,cc:0,    vint:1.00,
     note:'Highest free cash flow yield in the dataset at 4.8 percent. Decade-plus track record. Active DOJ antitrust cases create the regulatory discount that suppresses the multiple below where pure fundamentals would place it.'},
    {t:'AAPL', n:'Apple Inc.',                  cat:'Magnificent 7',          col:'#94a3b8',pe:30, roic:49,wacc:9, spread:40,gm:47,gt:'up',  moat:[92,95,85,50],fwdG:10,fcfG:9, fcfY:3.4, peg:3.0, reg:60,cc:0,    vint:1.00,
     note:'Best ecosystem switching cost score in the universe. Two decades of consistent quality. Single digit revenue growth at PEG 3.0 means the AI device upgrade cycle must materialise.'},
    {t:'META', n:'Meta Platforms',              cat:'Magnificent 7',          col:'#7c3aed',pe:22, roic:27,wacc:11,spread:16,gm:82,gt:'flat',moat:[82,65,98,38],fwdG:18,fcfG:14,fcfY:3.8, peg:1.22,reg:62,cc:0,    vint:0.85,
     note:'Highest gross margin in the dataset at 82 percent. The 65 billion dollar capex programme is the central forward risk. Vintage of 0.85 reflects rebuild from 2022.'},
    {t:'MSFT', n:'Microsoft Corporation',       cat:'Magnificent 7',          col:'#0096c7',pe:30, roic:31,wacc:9, spread:22,gm:69,gt:'flat',moat:[85,90,82,60],fwdG:15,fcfG:14,fcfY:2.5, peg:2.0, reg:65,cc:0,    vint:1.00,
     note:'Highest switching cost moat in the dataset. The safest enterprise profile. Two decades of consistent quality. The 99 billion dollar capex programme is the variable most likely to compress the spread.'},
    {t:'AMZN', n:'Amazon.com',                  cat:'Magnificent 7',          col:'#f59e0b',pe:32, roic:17,wacc:10,spread:7, gm:49,gt:'up',  moat:[70,80,88,52],fwdG:28,fcfG:35,fcfY:2.1, peg:1.14,reg:58,cc:0,    vint:0.70,
     note:'Lowest current quality spread among profitable Mag 7. Highest forward FCF growth in the universe at 35 percent. AWS margin expansion is changing the picture faster than consensus models capture.'},
    {t:'WMT',  n:'Walmart Inc.',                cat:'Retail',                 col:'#1d4ed8',pe:45, roic:12,wacc:7, spread:5, gm:25,gt:'up',  moat:[72,80,75,68],fwdG:10,fcfG:9, fcfY:1.4, peg:4.8, reg:75,cc:0,    vint:1.00,
     note:'Most durable physical retail moat. Advertising revenue grew 46 percent. PEG 4.8 is the structural problem. Full vintage credit cannot rescue the price.'},
    {t:'TSLA', n:'Tesla, Inc.',                 cat:'Magnificent 7',          col:'#ef4444',pe:110,roic:7, wacc:12,spread:-5,gm:18,gt:'dn',  moat:[35,45,60,50],fwdG:22,fcfG:18,fcfY:0.6, peg:5.0, reg:55,cc:0,    vint:0.55,
     note:'Only company with negative spread. Compressing margins from 29 percent to 18 percent. Valuation prices in autonomous vehicles at scale, none yet proven.'},
    {t:'MSTR', n:'Strategy (MicroStrategy)',    cat:'Bitcoin Treasury',       col:'#f97316',pe:null,roic:null,wacc:null,spread:null,gm:null,gt:'na',moat:[30,20,40,50],fwdG:null,fcfG:null,fcfY:null,peg:null,reg:35,cc:0,override:3.2, vint:null,
     note:'Bitcoin treasury vehicle. Override score of 3.2. Preferred dividends 904 million annually against revenue 475 million. Capital structure functions only if Bitcoin appreciates continuously.'},
    {t:'PLTR', n:'Palantir Technologies',       cat:'AI Software',            col:'#7c3aed',pe:108,roic:60,wacc:16,spread:44,gm:80,gt:'up',  moat:[78,82,65,60],fwdG:30,fcfG:35,fcfY:0.6, peg:2.36,reg:62,cc:0,    vint:0.55,
     note:'Vintage adjustment cuts deepest here. Only consistently profitable since 2023. Quality dropped from 8.52 to 4.69 once the 0.55 multiplier applied. Market gap correctly reads negative.'},
    {t:'V',    n:'Visa Inc.',                   cat:'Payments Network',       col:'#1a56db',pe:24, roic:33,wacc:8, spread:25,gm:80,gt:'flat',moat:[72,95,98,75],fwdG:12,fcfG:12,fcfY:3.8, peg:1.88,reg:70,cc:0,    vint:1.00,
     note:'Most durable payments network in existence. Spread of plus 25 percent sustained for over a decade. Two hundred billion transactions annually on infrastructure already built.'},
    {t:'TSM',  n:'Taiwan Semiconductor',        cat:'Semiconductor Foundry',  col:'#0f766e',pe:21, roic:40,wacc:12,spread:28,gm:58,gt:'up',  moat:[92,88,80,30],fwdG:28,fcfG:22,fcfY:2.0, peg:0.58,reg:30,cc:0,    vint:1.00,
     note:'Cheapest valuation relative to growth at PEG 0.58. Two decades of foundry dominance. Regulatory score of 3.0 captures Taiwan geopolitical risk — lowest in dataset.'},
    {t:'ASML', n:'ASML Holding',                cat:'Semiconductor Equipment',col:'#e11d48',pe:37, roic:35,wacc:10,spread:25,gm:52,gt:'up',  moat:[98,90,72,45],fwdG:18,fcfG:15,fcfY:2.5, peg:2.02,reg:45,cc:0,    vint:1.00,
     note:'Monopoly on extreme ultraviolet lithography. Pricing power score of 98 — the highest single indicator across the dataset.'},
    {t:'COST', n:'Costco Wholesale',            cat:'Retail',                 col:'#0369a1',pe:47, roic:22,wacc:9, spread:13,gm:13,gt:'up',  moat:[80,92,78,72],fwdG:9, fcfG:10,fcfY:2.1, peg:5.11,reg:72,cc:0,    vint:1.00,
     note:'Membership model inverts retail economics for over thirty years. Switching cost score is second highest in the universe. PEG of 5.11 is the precise valuation problem.'},
    {t:'BABA', n:'Alibaba Group',               cat:'Chinese Tech',           col:'#f97316',pe:19, roic:7, wacc:6, spread:1, gm:40,gt:'dn',  moat:[70,65,85,20],fwdG:8, fcfG:5, fcfY:1.7, peg:2.24,reg:15,cc:0,    vint:0.70,
     note:'Maximum narrative discount case. ROIC barely above WACC. FCF negative recently. Regulatory score 1.5 reflects Chinese government intervention.'},
    {t:'LLY',  n:'Eli Lilly and Company',       cat:'Healthcare',             col:'#dc2626',pe:26, roic:40,wacc:9, spread:31,gm:80,gt:'up',  moat:[92,75,55,80],fwdG:30,fcfG:25,fcfY:1.5, peg:1.26,reg:60,cc:0,    vint:0.85,
     note:'GLP-1 obesity drugs and diabetes franchise drove a structural inflection in 2023. ROIC of 40 percent with gross margin of 80 percent reflects pricing power that pharma rarely sustains. Vintage of 0.85 acknowledges the recency of the inflection.'},
    {t:'UNH',  n:'UnitedHealth Group',          cat:'Healthcare',             col:'#0c4a6e',pe:16, roic:9, wacc:5, spread:4, gm:23,gt:'flat',moat:[55,72,68,75],fwdG:8, fcfG:8, fcfY:5.2, peg:3.01,reg:65,cc:0,    vint:1.00,
     note:'Largest healthcare insurer in the United States. Spread is thin but durable across decades. Forward P/E of 16 with 5.2 percent FCF yield is unusual valuation for a defensive business of this scale.'},
    {t:'BRK.B',n:'Berkshire Hathaway',          cat:'Financial Services',     col:'#1e40af',pe:23, roic:17,wacc:6, spread:11,gm:35,gt:'flat',moat:[60,55,45,70],fwdG:8, fcfG:9, fcfY:3.5, peg:2.5, reg:80,cc:0,    vint:1.00,
     note:'Conglomerate with insurance float, equity portfolio, and operating businesses. Decades of compounding. Cash position over 300 billion dollars limits near-term return on capital but provides optionality.'},
    {t:'JPM',  n:'JPMorgan Chase',              cat:'Financial Services',     col:'#1e3a8a',pe:14, roic:12,wacc:7, spread:5, gm:60,gt:'flat',moat:[55,72,68,72],fwdG:8, fcfG:6, fcfY:6.5, peg:1.46,reg:70,cc:0,    vint:1.00,
     note:'Largest bank in America. Forward P/E of 14 with 6.5 percent FCF yield. Banks face structural challenges from regulation and capital requirements but the moat is durable.'},
    {t:'MA',   n:'Mastercard Incorporated',     cat:'Payments Network',       col:'#0891b2',pe:26, roic:50,wacc:8, spread:42,gm:78,gt:'flat',moat:[72,95,98,75],fwdG:14,fcfG:14,fcfY:3.0, peg:1.58,reg:70,cc:0,    vint:1.00,
     note:'Twin to Visa with similar network effect score. Even higher ROIC at 50 percent. Decade of consistent compounding. Both Visa and Mastercard score in the strongest tier of the framework.'},
    {t:'XOM',  n:'Exxon Mobil',                 cat:'Energy',                 col:'#7c2d12',pe:14, roic:14,wacc:8, spread:6, gm:32,gt:'flat',moat:[55,40,30,55],fwdG:5, fcfG:6, fcfY:5.8, peg:2.8, reg:60,cc:0,    vint:1.00,
     note:'Integrated oil major. Forward P/E of 14 with 5.8 percent FCF yield. The framework cannot capture the macro cyclicality of energy or the long-term energy transition risk.'},
    {t:'NFLX', n:'Netflix Inc.',                cat:'Streaming',              col:'#dc2626',pe:38, roic:25,wacc:10,spread:15,gm:45,gt:'up',  moat:[68,72,55,55],fwdG:22,fcfG:28,fcfY:2.4, peg:1.65,reg:65,cc:0,    vint:0.85,
     note:'Streaming leader with content moat and improving margins. Ads tier and password sharing crackdown drove a margin inflection in 2024. Vintage of 0.85 reflects the recency of margin expansion.'},
    {t:'NVO',  n:'Novo Nordisk',                cat:'Healthcare',             col:'#1e3a8a',pe:18, roic:55,wacc:7, spread:48,gm:83,gt:'flat',moat:[88,72,55,80],fwdG:18,fcfG:18,fcfY:3.5, peg:1.0, reg:65,cc:0,    vint:1.00,
     note:'Co-leader with Eli Lilly in the GLP-1 market through Wegovy and Ozempic. Decades of diabetes franchise predates the obesity inflection. Forward P/E of 18 makes this dramatically cheaper than Lilly on similar fundamentals.'},
    {t:'NOW',  n:'ServiceNow',                  cat:'Enterprise Software',    col:'#16a34a',pe:55, roic:25,wacc:10,spread:15,gm:79,gt:'flat',moat:[78,90,68,55],fwdG:22,fcfG:25,fcfY:1.6, peg:2.5, reg:65,cc:0,    vint:1.00,
     note:'Workflow automation platform with deep enterprise switching costs. Decade of consistent 20+ percent growth. P/E of 55 prices in the durability of the franchise.'},
    {t:'CRM',  n:'Salesforce',                  cat:'Enterprise Software',    col:'#0891b2',pe:25, roic:14,wacc:9, spread:5, gm:77,gt:'up',  moat:[68,85,55,55],fwdG:11,fcfG:15,fcfY:4.0, peg:2.27,reg:65,cc:0,    vint:1.00,
     note:'CRM market leader pivoting toward AI agents. Forward P/E of 25 with 4 percent FCF yield is reasonable. The Data Cloud and Agentforce thesis is the forward catalyst.'},
    {t:'NKE',  n:'Nike Inc.',                   cat:'Consumer Brands',        col:'#000000',pe:24, roic:18,wacc:9, spread:9, gm:44,gt:'dn',  moat:[78,55,55,55],fwdG:7, fcfG:5, fcfY:3.8, peg:3.43,reg:70,cc:0,    vint:0.70,
     note:'Brand moat tested by competition from Hoka, On, and direct-to-consumer disruption. Gross margin compressing. Vintage of 0.70 reflects the deterioration narrative since 2023.'},
    {t:'SBUX', n:'Starbucks',                   cat:'Consumer Brands',        col:'#1d4d3a',pe:25, roic:25,wacc:8, spread:17,gm:27,gt:'flat',moat:[80,72,55,55],fwdG:9, fcfG:10,fcfY:3.2, peg:2.78,reg:72,cc:0,    vint:1.00,
     note:'Global coffee brand with rewards program switching cost. Same-store sales pressure in China and competition in US challenge the growth profile.'},
    {t:'NESN', n:'Nestle SA',                   cat:'Consumer Brands',        col:'#7c2d12',pe:18, roic:14,wacc:6, spread:8, gm:48,gt:'flat',moat:[78,68,45,68],fwdG:5, fcfG:6, fcfY:5.0, peg:3.6, reg:75,cc:0,    vint:1.00,
     note:'Largest food company globally. Defensive consumer staple with brand portfolio depth. Forward P/E of 18 with 5 percent FCF yield is unusual for a slow-growing staple.'},
    {t:'ADBE', n:'Adobe Inc.',                  cat:'Enterprise Software',    col:'#dc2626',pe:18, roic:32,wacc:9, spread:23,gm:88,gt:'flat',moat:[85,90,55,55],fwdG:11,fcfG:13,fcfY:5.5, peg:1.64,reg:65,cc:0,    vint:1.00,
     note:'Creative software monopoly under threat from generative AI competition. Forward P/E of 18 with 5.5 percent FCF yield reflects the AI disruption discount. Gross margin of 88 percent remains industry-leading.'},
    {t:'TXN',  n:'Texas Instruments',           cat:'Semiconductor Foundry',  col:'#cc0000',pe:29, roic:20,wacc:10,spread:10,gm:57,gt:'flat',moat:[78,72,55,60],fwdG:21,fcfG:8, fcfY:1.8, peg:1.91,reg:65,cc:0,    vint:1.00,
     note:'World leader in analog and embedded processing chips with decade-plus dividend reliability. Spread of plus ten percent is moderate, suppressed near-term by an aggressive 35 billion dollar capex cycle to expand 300mm fabs in Texas and Utah. Free cash flow margin compressed from 35 percent in 2022 to under 15 percent today as those investments hit the income statement. Forward earnings growth of 21 percent reflects the expected return once capex normalises. The PEG of 1.91 and FCF yield of 1.8 percent place valuation in the watch zone — paying ahead of the recovery.'},
  ];

  function scoreQ(s, vint=1.0){
    if(s===null)return null;
    let base;
    if(s<=0)base=Math.max(0,1+s*.1);
    else if(s<=10)base=1+(s/10)*3;
    else if(s<=25)base=4+((s-10)/15)*3;
    else if(s<=50)base=7+((s-25)/25)*2;
    else base=Math.min(10,9+((s-50)/50));
    return base * vint;
  }
  function scoreD(gm,gt,moat,vint=1.0){
    const g=Math.min(10,(gm/85)*10),t=gt==='up'?9:gt==='flat'?6:2;
    const m=moat.reduce((a,b)=>a+b,0)/moat.length/10;
    const base=g*.35+t*.3+m*.35;
    return base * (0.5 + 0.5*vint);
  }
  function scoreG(fwd,fcf){if(fwd===null||fwd===undefined)return 0;return Math.min(10,((fwd+fcf)/2/100)*10);}
  function scoreV(peg,fcfY){if(peg===null||peg===undefined)return 0;return Math.max(0,Math.min(10,(5-peg)/4*10))*.5+Math.min(10,(fcfY/5)*10)*.5;}
  function scoreR(reg,cc){return Math.max(0,reg/10-cc*.3);}
  function impliedGrowthRequired(pe, targetPe=20, years=5){
    if(pe===null||pe===undefined||pe<=0) return null;
    return (Math.pow(pe/targetPe, 1/years) - 1) * 100;
  }
  function marketGapV2(pe, fwdG, fcfG){
    if(pe===null||pe===undefined||fwdG===null||fwdG===undefined) return null;
    const implied = impliedGrowthRequired(pe);
    const actual = (fwdG + (fcfG||fwdG)) / 2;
    const gap = actual - implied;
    return {score: Math.max(-5, Math.min(5, gap/5)), implied, actual, gap};
  }
  function pillarColor(s){if(s>=8)return 'var(--bull)';if(s>=6.5)return 'var(--ink)';if(s>=4.5)return 'var(--watch)';return 'var(--bear)';}
  function totalColor(s){if(s>=7)return 'var(--bull)';if(s>=5.5)return 'var(--ink)';if(s>=4)return 'var(--watch)';return 'var(--bear)';}
  function verdict(s,c){
    if(c.override!==undefined)return{l:'Treasury Vehicle',cls:'v-watch',key:'verdict-treasury'};
    if(s>=7)return{l:'Strong',cls:'v-strong',key:'verdict-strong'};
    if(s>=6)return{l:'Solid',cls:'v-fair',key:'verdict-solid'};
    if(s>=5)return{l:'Watch',cls:'v-watch',key:'verdict-watch'};
    if(s>=4)return{l:'Elevated Risk',cls:'v-risk',key:'verdict-risk'};
    return{l:'Speculative',cls:'v-risk',key:'verdict-speculative'};
  }
  function vintageClass(vint){
    if(vint===null||vint===undefined)return 'vint-mature';
    if(vint>=1.0)return 'vint-aged';
    if(vint>=0.85)return 'vint-mature';
    if(vint>=0.70)return 'vint-young';
    return 'vint-fresh';
  }
  function vintageLabel(vint){
    if(vint===null||vint===undefined)return 'N/A';
    if(vint>=1.0)return 'Aged';
    if(vint>=0.85)return 'Mature';
    if(vint>=0.70)return 'Young';
    return 'Fresh';
  }
  function vintageKey(vint){
    if(vint===null||vint===undefined)return 'vint-mature';
    if(vint>=1.0)return 'vint-aged';
    if(vint>=0.85)return 'vint-mature';
    if(vint>=0.70)return 'vint-young';
    return 'vint-fresh';
  }
  function allS(c){
    if(c.override!==undefined)return{q:2,d:1.5,g:4,v:1,r:3.5,tot:c.override,gap:null,qBase:null,dBase:null};
    const qBase=scoreQ(c.spread,1.0),dBase=scoreD(c.gm,c.gt,c.moat,1.0);
    const q=scoreQ(c.spread,c.vint),d=scoreD(c.gm,c.gt,c.moat,c.vint);
    const g=scoreG(c.fwdG,c.fcfG),v=scoreV(c.peg,c.fcfY),r=scoreR(c.reg,c.cc);
    const tot=q*W.quality+d*W.durability+g*W.growth+v*W.valuation+r*W.regulatory;
    const gap=marketGapV2(c.pe,c.fwdG,c.fcfG);
    return{q,d,g,v,r,tot,gap,qBase,dBase};
  }

  const PILLAR_DEFS = [
    {k:'q', l:'Quality',     w:0.30, weightLabel:'30%', adj:true,  glossKey:'quality'},
    {k:'d', l:'Durability',  w:0.20, weightLabel:'20%', adj:true,  glossKey:'durability'},
    {k:'g', l:'Growth',      w:0.20, weightLabel:'20%', adj:false, glossKey:'growth'},
    {k:'v', l:'Valuation',   w:0.20, weightLabel:'20%', adj:false, glossKey:'valuation'},
    {k:'r', l:'Regulatory',  w:0.10, weightLabel:'10%', adj:false, glossKey:'regulatory'},
  ];

  window.CORE = {
    W, COMPANIES, PILLAR_DEFS,
    scoreQ, scoreD, scoreG, scoreV, scoreR,
    impliedGrowthRequired, marketGapV2,
    pillarColor, totalColor, verdict,
    vintageClass, vintageLabel, vintageKey,
    allS,
  };
})();

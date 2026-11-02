'use strict';
/* MOTION. V1.4.2 | Anatomical atlas; the V1.4.1 strength exercises remain unchanged.
   Real mesh names come from Écorché, including deep and superficial left/right structures.
   No decorative fiber lines are added. */
const ATLAS_REGIONS = [
  {id:'head',name:'头颈',en:'HEAD & NECK',re:/frontalis|occipitalis|temporalis|masseter|zygomatic|orbicularis|buccinator|nasalis|procerus|platysma|sternocleidomastoid|scalen|longus (colli|capitis)|splenius|semispinalis capitis|levator scapulae|digastric|stylo|mylohyoid|geniohyoid|omohyoid|thyrohyoid|infrahyoid|suprahyoid|auricular|depressor (anguli|labii)|mentalis|risorius|corrugator/i},
  {id:'shoulder',name:'肩部',en:'SHOULDERS',re:/deltoid|supraspinatus|infraspinatus|subscapularis|teres major|teres minor/i},
  {id:'chest',name:'胸廓',en:'CHEST & RIBS',re:/pectoralis|serratus anterior|intercostal|subclavius|transversus thoracis|diaphragm/i},
  {id:'back',name:'背部与脊柱',en:'BACK & SPINE',re:/trapezius|rhomboid|latissimus|erector spinae|iliocostalis|longissimus|spinalis|multifidus|rotatores|serratus posterior|quadratus lumborum|semispinalis thoracis|interspinal|intertransvers|thoracolumbar/i},
  {id:'arms',name:'上臂与前臂',en:'ARMS & FOREARMS',re:/biceps brachii|brachialis|brachioradialis|triceps brachii|anconeus|pronator|supinator|palmaris|flexor carpi|extensor carpi|flexor digitorum|extensor digitorum|flexor pollicis|extensor pollicis|abductor pollicis longus|extensor indicis|flexor hallucis|lumbrical|interosseous|opponens|abductor digiti minimi|adductor pollicis/i},
  {id:'core',name:'腹部与深层核心',en:'CORE & ABDOMEN',re:/rectus abdominis|obliquus|oblique|transversus abdominis|psoas|iliacus|pyramidalis|cremaster/i},
  {id:'glutes',name:'臀部与深层髋肌',en:'GLUTES & HIP',re:/gluteus|piriformis|gemell(us|i)|obturator (internus|externus)|quadratus femoris|tensor fasciae latae/i},
  {id:'thigh',name:'大腿与膝部',en:'THIGHS & KNEES',re:/rectus femoris|vastus|sartorius|pectineus|adductor|gracilis|biceps femoris|semitendinosus|semimembranosus|articularis genu|quadriceps/i},
  {id:'leg',name:'小腿与踝部',en:'LOWER LEGS',re:/gastrocnemius|soleus|plantaris|tibialis|popliteus|fibularis|peroneus|extensor hallucis|flexor hallucis|extensor digitorum longus|flexor digitorum longus/i},
  {id:'foot',name:'手足深层小肌群',en:'HANDS & FEET',re:/abductor hallucis|abductor digiti|flexor digitorum brevis|extensor digitorum brevis|lumbrical|interosse|opponens|flexor digiti|flexor pollicis brevis|adductor hallucis|quadratus plantae/i},
  {id:'other',name:'其他肌肉',en:'OTHER STRUCTURES',re:null}
];
const ATLAS_ZH = {
  'gluteus maximus':'臀大肌','gluteus medius':'臀中肌','gluteus minimus':'臀小肌',
  'piriformis':'梨状肌','tensor fasciae latae':'阔筋膜张肌','obturator internus':'闭孔内肌','obturator externus':'闭孔外肌','quadratus femoris':'股方肌','gemellus superior':'上孖肌','gemellus inferior':'下孖肌',
  'trapezius':'斜方肌','latissimus dorsi':'背阔肌','rhomboid major':'菱形肌大肌','rhomboid minor':'菱形肌小肌','levator scapulae':'肩胛提肌','serratus anterior':'前锯肌','serratus posterior superior':'上后锯肌','serratus posterior inferior':'下后锯肌',
  'supraspinatus':'冈上肌','infraspinatus':'冈下肌','subscapularis':'肩胛下肌','teres major':'大圆肌','teres minor':'小圆肌','deltoid':'三角肌',
  'pectoralis major':'胸大肌','pectoralis minor':'胸小肌','subclavius':'锁骨下肌','diaphragm':'膈肌',
  'rectus abdominis':'腹直肌','external oblique':'腹外斜肌','internal oblique':'腹内斜肌','transversus abdominis':'腹横肌','quadratus lumborum':'腰方肌','psoas major':'腰大肌','psoas minor':'腰小肌','iliacus':'髂肌','multifidus':'多裂肌',
  'sternocleidomastoid':'胸锁乳突肌','scalenus anterior':'前斜角肌','scalenus medius':'中斜角肌','scalenus posterior':'后斜角肌','splenius capitis':'头夹肌','splenius cervicis':'颈夹肌','masseter':'咬肌','temporalis':'颞肌','frontalis':'额肌','orbicularis oculi':'眼轮匝肌','orbicularis oris':'口轮匝肌',
  'biceps brachii':'肱二头肌','triceps brachii':'肱三头肌','brachialis':'肱肌','brachioradialis':'肱桡肌','anconeus':'肘肌','pronator teres':'旋前圆肌','supinator':'旋后肌',
  'rectus femoris':'股直肌','vastus lateralis':'股外侧肌','vastus medialis':'股内侧肌','vastus intermedius':'股中间肌','sartorius':'缝匠肌','gracilis':'股薄肌','pectineus':'耻骨肌','adductor magnus':'大收肌','adductor longus':'长收肌','adductor brevis':'短收肌',
  'biceps femoris':'股二头肌','semitendinosus':'半腱肌','semimembranosus':'半膜肌','gastrocnemius':'腓肠肌','soleus':'比目鱼肌','plantaris':'跖肌','tibialis anterior':'胫骨前肌','tibialis posterior':'胫骨后肌','popliteus':'腘肌','fibularis longus':'腓骨长肌','fibularis brevis':'腓骨短肌','peroneus longus':'腓骨长肌','peroneus brevis':'腓骨短肌',
  'flexor digitorum longus':'趾长屈肌','extensor digitorum longus':'趾长伸肌','flexor hallucis longus':'𧿹长屈肌','extensor hallucis longus':'𧿹长伸肌','abductor hallucis':'𧿹展肌'
};
const ATLAS_ZH_EXTRA = {
  "ascending part of trapezius": "斜方肌下束",
  "descending part of trapezius": "斜方肌上束",
  "transverse part of trapezius": "斜方肌中束",
  "ascending part of right trapezius": "斜方肌下束",
  "descending part of right trapezius": "斜方肌上束",
  "transverse part of right trapezius": "斜方肌中束",
  "ascending part of left trapezius": "斜方肌下束",
  "descending part of left trapezius": "斜方肌上束",
  "transverse part of left trapezius": "斜方肌中束",
  "infraspinatus muscle": "冈下肌",
  "supraspinatus muscle": "冈上肌",
  "subscapularis muscle": "肩胛下肌",
  "rhomboid major": "大菱形肌",
  "rhomboid minor": "小菱形肌",
  "gluteus medius muscle": "臀中肌",
  "gluteus minimus muscle": "臀小肌",
  "gluteus maximus muscle": "臀大肌",
  "serratus anterior muscle": "前锯肌",
  "clavicular head of pectoralis major": "胸大肌锁骨部",
  "sternocostal head of pectoralis major": "胸大肌胸肋部",
  "abdominal part of pectoralis major": "胸大肌腹部",
  "clavicular part of pectoralis major": "胸大肌锁骨部",
  "sternocostal part of pectoralis major": "胸大肌胸肋部",
  "anterior part of deltoid": "三角肌前束",
  "middle part of deltoid": "三角肌中束",
  "posterior part of deltoid": "三角肌后束",
  "acromial part of deltoid": "三角肌中束",
  "clavicular part of deltoid": "三角肌前束",
  "spinal part of deltoid": "三角肌后束",
  "long head of biceps brachii": "肱二头肌长头",
  "short head of biceps brachii": "肱二头肌短头",
  "long head of triceps brachii": "肱三头肌长头",
  "lateral head of triceps brachii": "肱三头肌外侧头",
  "medial head of triceps brachii": "肱三头肌内侧头",
  "long head of biceps femoris": "股二头肌长头",
  "short head of biceps femoris": "股二头肌短头",
  "coracobrachialis": "喙肱肌",
  "palmaris longus": "掌长肌",
  "palmaris brevis": "掌短肌",
  "flexor carpi radialis": "桡侧腕屈肌",
  "flexor carpi ulnaris": "尺侧腕屈肌",
  "extensor carpi radialis longus": "桡侧腕长伸肌",
  "extensor carpi radialis brevis": "桡侧腕短伸肌",
  "extensor carpi ulnaris": "尺侧腕伸肌",
  "flexor digitorum superficialis": "指浅屈肌",
  "flexor digitorum profundus": "指深屈肌",
  "extensor digitorum": "指伸肌",
  "extensor indicis": "示指伸肌",
  "extensor digiti minimi": "小指伸肌",
  "extensor pollicis longus": "拇长伸肌",
  "extensor pollicis brevis": "拇短伸肌",
  "flexor pollicis longus": "拇长屈肌",
  "flexor pollicis brevis": "拇短屈肌",
  "abductor pollicis longus": "拇长展肌",
  "abductor pollicis brevis": "拇短展肌",
  "adductor pollicis": "拇收肌",
  "opponens pollicis": "拇对掌肌",
  "opponens digiti minimi": "小指对掌肌",
  "abductor digiti minimi": "小指展肌",
  "flexor digiti minimi brevis": "小指短屈肌",
  "pronator quadratus": "旋前方肌",
  "pronator teres": "旋前圆肌",
  "brachioradialis": "肱桡肌",
  "extensor pollicis brevis muscle": "拇短伸肌",
  "iliocostalis cervicis": "颈髂肋肌",
  "iliocostalis thoracis": "胸髂肋肌",
  "iliocostalis lumborum": "腰髂肋肌",
  "longissimus capitis": "头最长肌",
  "longissimus cervicis": "颈最长肌",
  "longissimus thoracis": "胸最长肌",
  "spinalis capitis": "头棘肌",
  "spinalis cervicis": "颈棘肌",
  "spinalis thoracis": "胸棘肌",
  "semispinalis capitis": "头半棘肌",
  "semispinalis cervicis": "颈半棘肌",
  "semispinalis thoracis": "胸半棘肌",
  "multifidus lumborum": "腰多裂肌",
  "multifidus thoracis": "胸多裂肌",
  "multifidus cervicis": "颈多裂肌",
  "rotatores": "回旋肌",
  "interspinales": "棘间肌",
  "intertransversarii": "横突间肌",
  "erector spinae": "竖脊肌",
  "obliquus capitis superior": "头上斜肌",
  "obliquus capitis inferior": "头下斜肌",
  "rectus capitis posterior major": "头后大直肌",
  "rectus capitis posterior minor": "头后小直肌",
  "rectus capitis lateralis": "头外侧直肌",
  "rectus capitis anterior": "头前直肌",
  "longus colli": "颈长肌",
  "longus capitis": "头长肌",
  "levator scapulae": "肩胛提肌",
  "upper part of trapezius": "斜方肌上束",
  "middle part of trapezius": "斜方肌中束",
  "lower part of trapezius": "斜方肌下束",
  "deep transverse perineal": "会阴深横肌",
  "platysma": "颈阔肌",
  "sternohyoid": "胸骨舌骨肌",
  "sternothyroid": "胸骨甲状肌",
  "omohyoid": "肩胛舌骨肌",
  "stylohyoid": "茎突舌骨肌",
  "mylohyoid": "下颌舌骨肌",
  "geniohyoid": "颏舌骨肌",
  "digastric": "二腹肌",
  "buccinator": "颊肌",
  "zygomaticus major": "颧大肌",
  "zygomaticus minor": "颧小肌",
  "orbicularis oculi": "眼轮匝肌",
  "orbicularis oris": "口轮匝肌",
  "frontalis": "额肌",
  "occipitalis": "枕肌",
  "procerus": "降眉间肌",
  "corrugator supercilii": "皱眉肌",
  "levator labii superioris": "上唇方肌",
  "levator anguli oris": "提口角肌",
  "depressor anguli oris": "降口角肌",
  "depressor labii inferioris": "降下唇肌",
  "risorius": "笑肌",
  "mentalis": "颏肌",
  "nasalis": "鼻肌",
  "auricularis anterior": "耳前肌",
  "auricularis posterior": "耳后肌",
  "medial pterygoid": "翼内肌",
  "lateral pterygoid": "翼外肌",
  "superior head of lateral pterygoid": "翼外肌上头",
  "inferior head of lateral pterygoid": "翼外肌下头",
  "scalenus anterior": "前斜角肌",
  "scalenus medius": "中斜角肌",
  "scalenus posterior": "后斜角肌",
  "anterior scalene": "前斜角肌",
  "middle scalene": "中斜角肌",
  "posterior scalene": "后斜角肌",
  "iliotibial tract": "髂胫束",
  "biceps femoris long head": "股二头肌长头",
  "biceps femoris short head": "股二头肌短头",
  "gracilis": "股薄肌",
  "adductor minimus": "小收肌",
  "adductor magnus": "大收肌",
  "adductor longus": "长收肌",
  "adductor brevis": "短收肌",
  "adductor hallucis": "拇收肌（足）",
  "abductor hallucis": "拇展肌（足）",
  "abductor digiti minimi pedis": "小趾展肌",
  "flexor hallucis longus": "拇长屈肌（足）",
  "flexor hallucis brevis": "拇短屈肌（足）",
  "extensor hallucis longus": "拇长伸肌（足）",
  "extensor hallucis brevis": "拇短伸肌（足）",
  "flexor digitorum longus": "趾长屈肌",
  "flexor digitorum brevis": "趾短屈肌",
  "extensor digitorum longus": "趾长伸肌",
  "extensor digitorum brevis": "趾短伸肌",
  "quadratus plantae": "足底方肌",
  "lumbricals": "蚓状肌",
  "lumbrical": "蚓状肌",
  "interossei": "骨间肌",
  "dorsal interossei": "骨间背侧肌",
  "plantar interossei": "足底骨间肌",
  "fibularis tertius": "第三腓骨肌",
  "peroneus tertius": "第三腓骨肌",
  "gluteus medius": "臀中肌",
  "gluteus minimus": "臀小肌",
  "gluteus maximus": "臀大肌",
  "gluteus medius anterior fibers": "臀中肌前部纤维",
  "gluteus medius posterior fibers": "臀中肌后部纤维",
  "iliopsoas": "髂腰肌",
  "quadratus femoris": "股方肌",
  "gemellus superior": "上孖肌",
  "gemellus inferior": "下孖肌",
  "superior gemellus": "上孖肌",
  "inferior gemellus": "下孖肌",
  "rectus femoris": "股直肌",
  "articularis genu": "膝关节肌",
  "serratus posterior superior": "上后锯肌",
  "serratus posterior inferior": "下后锯肌",
  "external oblique": "腹外斜肌",
  "internal oblique": "腹内斜肌",
  "obliquus externus abdominis": "腹外斜肌",
  "obliquus internus abdominis": "腹内斜肌",
  "serratus anterior": "前锯肌",
  "subclavius": "锁骨下肌",
  "pectoralis minor": "胸小肌",
  "pectoralis major": "胸大肌",
  "gastrocnemius lateral head": "腓肠肌外侧头",
  "gastrocnemius medial head": "腓肠肌内侧头",
  "lateral head of gastrocnemius": "腓肠肌外侧头",
  "medial head of gastrocnemius": "腓肠肌内侧头",
  "soleus": "比目鱼肌",
  "popliteus": "腘肌",
  "plantaris": "跖肌",
  "peroneus longus": "腓骨长肌",
  "peroneus brevis": "腓骨短肌",
  "fibularis longus": "腓骨长肌",
  "fibularis brevis": "腓骨短肌"
};
const ATLAS_INFO = {
 'gluteus maximus':['臀部表层的大块肌肉，覆盖骨盆后部至股骨及髂胫束区域。','主要参与髋伸，并根据姿势参与髋外旋和外展等动作。','gluteMax'],
 'gluteus medius':['臀部外侧的扇形肌，部分位于臀大肌深层。','参与髋外展和单腿支撑时的骨盆控制。','gluteMed'],
 'gluteus minimus':['臀中肌深面的较小扇形肌，连接髂骨外侧与股骨大转子。','参与髋外展、髋内旋与单腿支撑时的骨盆控制。','gluteMed'],
 'trapezius':['覆盖上背与颈后部的浅层肌肉。','不同肌束共同参与肩胛上旋、提升、后缩和稳定。','traps'],
 'latissimus dorsi':['背部两侧广泛分布的大块肌肉。','参与肩伸、内收和内旋。','lats'],
 'serratus anterior':['位于胸廓外侧、肩胛骨深面的肌肉。','参与肩胛前伸、上旋以及贴附胸廓。',''],
 'rectus abdominis':['位于腹部前方的成对长肌。','参与躯干屈曲及腹压调节。','abs'],
 'gastrocnemius':['小腿后方较浅层的双关节肌肉。','参与踝跖屈，也参与膝屈。','calves'],
 'soleus':['小腿后方比目鱼肌，主要位于腓肠肌深面。','参与踝跖屈及站立支撑。','calves'],
 'biceps femoris':['大腿后侧腘绳肌群的一部分。','参与膝屈，长头也参与髋伸。','hamstrings'],
 'semitendinosus':['大腿后侧腘绳肌群之一。','参与髋伸与膝屈。','hamstrings'],
 'semimembranosus':['大腿后侧腘绳肌群之一。','参与髋伸与膝屈。','hamstrings'],
 'rectus femoris':['股四头肌中跨髋膝两关节的一部分。','参与伸膝与髋屈。','quads'],
 'vastus lateralis':['大腿前外侧股四头肌成员。','主要参与伸膝。','quads'],
 'vastus medialis':['大腿前内侧股四头肌成员。','主要参与伸膝。','quads'],
 'vastus intermedius':['股直肌深面的股四头肌成员。','主要参与伸膝。','quads'],
 'deltoid':['肩部表层三角肌。','不同肌束参与肩外展、屈曲和伸展等。','delts'],
 'pectoralis major':['胸前表层大肌肉。','参与肩水平内收、内收和内旋。','pecs'],
 'psoas major':['腰椎前方延伸到股骨近端的深层肌肉。','参与髋屈，并影响腰盆区域的受力。',''],
 'piriformis':['臀部深层、位于髋关节后方的肌肉。','主要与髋旋转和髋部稳定有关。','']
};
const ATLAS_ALIASES = {gluteMax:'gluteus maximus',gluteMed:'gluteus medius',hamstrings:'biceps femoris',traps:'trapezius',lats:'latissimus dorsi',abs:'rectus abdominis',quads:'rectus femoris',calves:'gastrocnemius',delts:'deltoid',pecs:'pectoralis major'};
const atlasState={region:'',name:'gluteus medius',filter:'',items:[],loaded:false,meshCount:0};
function atlasCleanName(x){
 return String(x||'').replace(/_/g,' ').toLowerCase()
  .replace(/\b(left|right|midline)\b/gi,' ')
  .replace(/\s*\(\d+\)\s*$/,'')
  .replace(/\s+/g,' ').trim();
}
function atlasRegionFor(n){return (ATLAS_REGIONS.find(r=>r.id!=='other'&&r.re.test(n))||ATLAS_REGIONS.at(-1)).id}
function atlasDisplayName(n){
 const key=atlasCleanName(n);
 if(ATLAS_ZH_EXTRA[key]||ATLAS_ZH[key])return ATLAS_ZH_EXTRA[key]||ATLAS_ZH[key];
 // Prefer a clinically meaningful Chinese group name over exposing model internals as primary UI.
 const grouped=[
   [/trapezius/, '斜方肌'],[/deltoid/, '三角肌'],[/gluteus/, '臀肌'],
   [/rhomboid/, '菱形肌'],[/intercostal/, '肋间肌'],[/interosse/, '骨间肌'],
   [/flexor/, '屈肌'],[/extensor/, '伸肌'],[/levator/, '提肌'],
   [/depressor/, '降肌'],[/oblique|obliquus/, '斜肌'],[/serratus/, '锯肌'],
   [/quadratus/, '方肌'],[/adductor/, '收肌'],[/abductor/, '展肌'],
   [/pectoralis/, '胸肌'],[/rectus/, '直肌'],[/spinalis/, '脊柱旁肌'],
   [/digastric/, '二腹肌'],[/thyroid/, '甲状相关肌'],[/hyoid/, '舌骨相关肌']
 ];
 const group=grouped.find(x=>x[0].test(key));
 return group?group[1]+' · 待校对细分名称':'其他肌肉 · 待校对名称';
}
function atlasEnglishName(n){
 return atlasCleanName(n).replace(/\b[a-z]/g,c=>c.toUpperCase());
}
function atlasEsc(s){return esc(String(s??''))}
function atlasLoadList(items){atlasState.items=items;atlasState.loaded=items.length>0;atlasState.meshCount=items.reduce((a,b)=>a+b.count,0);atlasUpdate();}
function atlasRegionCount(id){return atlasState.items.filter(v=>v.region===id).length}
function atlasSummary(n){
 const key=atlasCleanName(n);
 const data=ATLAS_INFO[key];if(data)return data;
 // Muscle subparts share the same conservative overview and exercise associations.
 const family=[['trapezius','trapezius'],['deltoid','deltoid'],['pectoralis major','pectoralis major'],
 ['gluteus medius','gluteus medius'],['gluteus maximus','gluteus maximus'],
 ['gastrocnemius','gastrocnemius'],['biceps femoris','biceps femoris'],
 ['rectus femoris','rectus femoris']].find(([part])=>key.includes(part));
 if(family&&ATLAS_INFO[family[1]])return ATLAS_INFO[family[1]];
 return ['解剖模型中的肌肉结构；可通过 3D 旋转观察其位置。','该细分结构的功能与关联动作尚未完成核对，因此暂不展示未经确认的说明。',''];
}
function atlasRelatedMuscle(n){const p=atlasSummary(n)[2];return p&&typeof getRelated==='function'?getRelated(p):[]}
function atlasEnter(r){atlasState.region=r;atlasState.filter='';atlasState.name=(r==='glutes'?'gluteus medius':atlasState.items.find(x=>x.region===r)?.name||'');atlasUpdate(true)}
function atlasBack(){atlasState.region='';atlasState.name='';atlasState.filter='';atlasUpdate(true)}
function atlasSelect(n){atlasState.name=n;atlasUpdate(false)}
function atlasSetFilter(v){atlasState.filter=v;atlasUpdate(false)}
function atlasOpenRelated(id){if(typeof openExercise==='function')openExercise(id)}
function atlasCard(e){return exerciseCard(e)}
function atlasSkeletonSVG(){return `<svg viewBox="0 0 170 360" role="img" aria-label="全身人体示意"><g fill="none" stroke="#C8AD96" stroke-width="13" stroke-linecap="round"><path d="M85 66v120 M85 86L43 155 35 214M85 86l42 69 8 59M85 182L59 265 55 334M85 182l26 83 4 69"/></g><circle cx="85" cy="35" r="26" fill="#EBDACA" stroke="#D9C6B4" stroke-width="2"/><path d="M54 80Q85 65 116 80L113 176Q85 202 57 176Z" fill="#E5D0BF" opacity=".9"/><g fill="#D4956D" opacity=".65"><ellipse cx="68" cy="182" rx="15" ry="15"/><ellipse cx="103" cy="182" rx="15" ry="15"/><ellipse cx="60" cy="117" rx="10" ry="26"/><ellipse cx="109" cy="117" rx="10" ry="26"/></g></svg>`}
function atlasScreen(){
 const s=atlasState,r=ATLAS_REGIONS.find(x=>x.id===s.region),entry=s.items.find(x=>x.name===s.name),related=atlasRelatedMuscle(s.name),info=atlasSummary(s.name);
 if(!r)return `<div class="motion-atlas"><div class="atlas-eyebrow">01 / SELECT REGION</div><h2 class="atlas-title">The body,<br><i>in layers.</i></h2><p class="atlas-lead">点击身体区域，探索全身肌肉。真实 3D 模型可旋转、放大；左右同名肌肉合并展示，也能查看深层结构。</p><div class="atlas-stage atlas-stage-wide" id="motion-atlas-stage"><div class="atlas-standin" id="atlas-fallback">${atlasSkeletonSVG()}<div class="atlas-fallback-note">正在准备 3D 人体模型…</div></div></div><div class="atlas-stage-footer"><span id="atlas-load-state">${s.loaded?`已索引 ${s.items.length} 个肌肉名称`:'首次加载真实解剖网格需要网络'}</span><button class="atlas-mini" type="button" onclick="window.motionAtlas3D?.reset()">复位视角</button></div><div class="atlas-region-list">${ATLAS_REGIONS.map(a=>`<button class="atlas-region-btn" onclick="atlasEnter('${a.id}')"><strong>${a.name}</strong><small>${a.en}${s.loaded?` · ${atlasRegionCount(a.id)} 组肌肉`:''}</small><span>›</span></button>`).join('')}</div><p class="atlas-disclaimer">图谱使用 Écorché 真实解剖网格。骨骼保留象牙白，肌肉采用柔和杏色，同时保留原有形态与明暗过渡；不添加人工肌束线。模型不是个人解剖扫描，不用于医疗诊断。</p></div>`;
 const entries=s.items.filter(x=>x.region===r.id).filter(x=>!s.filter||x.name.includes(s.filter.toLowerCase())||atlasDisplayName(x.name).includes(s.filter));
 const fallback=r.id==='glutes'?[{name:'gluteus maximus'},{name:'gluteus medius'},{name:'gluteus minimus'}]:[];
 const shown=s.loaded?(r.id==='glutes'?[...entries].sort((a,b)=>{const rank=x=>['gluteus maximus','gluteus medius','gluteus minimus'].indexOf(x.name);const ar=rank(a),br=rank(b);return (ar<0?100:ar)-(br<0?100:br) || a.name.localeCompare(b.name)}):entries):fallback;
 return `<div class="motion-atlas"><button class="atlas-back" onclick="atlasBack()">← 返回全身图谱</button><div class="atlas-eyebrow">02 / ${r.en}</div><h2 class="atlas-title atlas-region-title">${r.name}<span>.</span></h2><p class="atlas-lead">点击肌肉切换结构；深层肌肉会隐藏遮挡层，以便看清与骨骼的位置关系。</p><div class="atlas-pills">${shown.slice(0,3).map(x=>`<button class="atlas-pill ${s.name===x.name?'active':''}" onclick="atlasSelect('${atlasEsc(x.name)}')">${atlasEsc(atlasDisplayName(x.name))}</button>`).join('')}</div><div class="atlas-stage atlas-stage-local" id="motion-atlas-stage"><div class="atlas-standin" id="atlas-fallback">${atlasSkeletonSVG()}<div class="atlas-fallback-note">${s.loaded?'正在定位局部结构…':'3D 首次加载需要网络'}</div></div></div><div class="atlas-stage-footer"><span id="atlas-load-state">${s.loaded?'可旋转 · 双指缩放 · 点击肌肉':'正在准备解剖模型…'}</span><button class="atlas-mini" onclick="window.motionAtlas3D?.reset()">复位视角</button></div><div class="atlas-search-row"><input id="atlas-search" type="search" placeholder="搜索此区域的肌肉名称" value="${atlasEsc(s.filter)}" oninput="atlasSetFilter(this.value)"><span>${shown.length} / ${s.loaded?atlasRegionCount(r.id):3}</span></div><div class="atlas-muscle-choices">${shown.map(x=>`<button class="atlas-muscle-choice ${s.name===x.name?'chosen':''}" onclick="atlasSelect('${atlasEsc(x.name)}')">${atlasEsc(atlasDisplayName(x.name))}<small>${atlasEsc(atlasEnglishName(x.name))}${x.deep?' · 深层':''}</small></button>`).join('')||'<p class="atlas-lead">当前无匹配肌肉，请换一个搜索词。</p>'}</div><section class="atlas-info"><span class="atlas-eyebrow">01 · 基础信息</span><h3>${atlasEsc(atlasDisplayName(s.name))}</h3><p class="atlas-latin">${atlasEsc(atlasEnglishName(s.name))}</p><div class="atlas-info-grid"><b>位置</b><p>${atlasEsc(info[0])}</p><b>主要功能</b><p>${atlasEsc(info[1])}</p><b>层次</b><p>${entry?.deep?'深层肌肉':entry?'表层肌肉或肌群结构':'选择 3D 肌肉后展示'}</p></div></section><section class="atlas-related"><div class="atlas-related-head"><strong>相关动作</strong><span>${related.length} EXERCISES</span></div>${related.length?`<div class="activity-list">${related.map(e=>atlasCard(e)).join('')}</div>`:'<div class="atlas-empty">这块肌肉尚未在 V1.4.1 动作库建立经核对的关联。你仍然可以在 Exercises 搜索动作。</div>'}</section><p class="atlas-disclaimer">左、右侧肌肉合并为一个名称，点击后双侧同步高亮。点击具体动作，仍延用 V1.4.1 的动作详情、笔记与加入计划方式。</p></div>`;
}
function atlasUpdate(scroll=false){if(state.nav!=='strength'||state.strengthTab!=='anatomy')return;const el=document.querySelector('#main');if(!el)return;
 const active=document.activeElement;const wasSearch=active?.id==='atlas-search';const pos=wasSearch?active.selectionStart:0;
 render();
 if(wasSearch){const input=document.getElementById('atlas-search');input?.focus();try{input?.setSelectionRange(pos,pos)}catch{}}
 requestAnimationFrame(()=>window.motionAtlas3D?.attach());
 if(scroll)scrollTo({top:0,behavior:'smooth'});
}
const anatomyScreenV141=anatomyScreen;
anatomyScreen=atlasScreen;
// Restore view correctly when the Strength tab is navigated to without changing any other module.
const renderV141=render;
render=function(){renderV141();if(state.nav==='strength'&&state.strengthTab==='anatomy')requestAnimationFrame(()=>window.motionAtlas3D?.attach());else window.motionAtlas3D?.pause()};
// Keeps V1.4.1 action detail, plans, history, gear, imported workouts intact.

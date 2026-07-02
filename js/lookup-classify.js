// ════════════════════════════════════════════════════════
// LOOKUP CLASSIFY — suy đoán từ loại, độ khó (CEFR), chủ đề, và gợi ý nghĩa
// tiếng Việt có sẵn cho các từ rất phổ biến (không cần chờ API).
// ════════════════════════════════════════════════════════
const VI_HINTS = {
  happy:'vui vẻ, hạnh phúc', sad:'buồn bã', angry:'tức giận', fear:'sợ hãi',
  love:'tình yêu, yêu thương', hate:'ghét', joy:'niềm vui', grief:'đau buồn',
  anxiety:'lo lắng', calm:'bình tĩnh', excited:'hào hứng', bored:'chán nản',
  brave:'dũng cảm', kind:'tốt bụng', smart:'thông minh', lazy:'lười biếng',
  honest:'thành thật', rude:'thô lỗ', shy:'nhút nhát', confident:'tự tin',
  creative:'sáng tạo', patient:'kiên nhẫn', generous:'hào phóng',
  run:'chạy', walk:'đi bộ', eat:'ăn', drink:'uống', sleep:'ngủ',
  work:'làm việc', study:'học', read:'đọc', write:'viết', speak:'nói',
  listen:'lắng nghe', think:'suy nghĩ', help:'giúp đỡ', learn:'học hỏi',
  water:'nước', fire:'lửa', tree:'cây', flower:'hoa', animal:'động vật',
  mountain:'núi', river:'sông', ocean:'đại dương', sky:'bầu trời', sun:'mặt trời',
};

function mapPartOfSpeech(pos) {
  if (!pos) return 'other';
  const p = pos.toLowerCase();
  if (p.includes('noun') || p === 'pronoun') return 'noun';
  if (p.includes('adjective')) return 'adj';
  // "adverb" phải xét TRƯỚC "verb" — chuỗi "adverb" chứa substring "verb"
  // (ad-VERB), nên đảo thứ tự sẽ khiến mọi POS "adverb" bị nhận nhầm thành verb.
  if (p.includes('adverb')) return 'adv';
  if (p.includes('verb') || p.includes('auxiliary')) return 'verb';
  if (p.includes('phrase') || p.includes('idiom') || p.includes('expression')) return 'phrase';
  return 'other';
}

const POS_LABEL_VI = { noun:'danh từ', verb:'động từ', adj:'tính từ', adv:'trạng từ', phrase:'cụm từ', other:'khác' };

// Danh sách từ CEFR A1-A2 phổ biến (easy) và C1-C2 phổ biến (hard)
// Từ không nằm trong hai danh sách này → medium (B1-B2)
const CEFR_EASY = new Set([
  'a','able','about','above','after','again','age','ago','all','also','always','am','an','and','animal',
  'another','any','are','ask','at','away','back','bad','be','because','before','big','blue','book',
  'both','boy','bread','but','buy','by','call','can','car','cat','city','class','clean','come','cool',
  'could','country','day','do','dog','door','down','drink','drive','eat','end','english','even','every',
  'eye','face','far','fast','find','first','food','for','friend','from','get','girl','give','go','good',
  'great','green','had','hair','hand','happy','have','he','help','her','here','him','his','home','hot',
  'house','how','if','in','is','it','job','just','kind','know','large','last','late','learn','left',
  'like','little','live','long','look','lot','love','make','man','many','me','meet','milk','more','most',
  'mother','much','my','name','new','next','nice','no','not','now','number','of','old','on','one','open',
  'or','other','our','out','over','own','part','people','phone','place','play','please','put','read',
  'red','right','run','sad','same','school','see','she','sleep','small','some','son','soon','sorry',
  'speak','start','stay','stop','study','sun','take','talk','teacher','tell','than','thank','that','the',
  'their','them','then','there','they','thing','think','this','time','to','today','together','too','try',
  'under','up','use','very','walk','want','warm','water','way','we','well','what','when','where','which',
  'white','who','why','will','with','work','world','write','year','yes','you','young','your',
  'bad','deft','grim','taut','gush','keen','limp','mild','neat','pale','rash','tame','vain','wary','woe',
]);
const CEFR_HARD = new Set([
  'aberrant','abhorrent','abject','abrogate','abscond','abstain','abstinence','acrimony','acumen',
  'admonish','adroit','adversarial','aegis','affidavit','aggrandize','alacrity','alleviate','ameliorate',
  'anachronism','anomalous','antipathy','apocryphal','approbation','arduous','ascertain','asperity',
  'assiduous','atrophy','audacious','auspicious','austere','avarice','banal','belligerent','benevolent',
  'bequeath','besmirch','cacophony','capricious','catharsis','caustic','chicanery','circumspect',
  'clandestine','coerce','cogent','complacent','convoluted','copious','corroborate','credulous',
  'culpable','cursory','debilitate','decorum','deleterious','demagogue','deprecated','depravity',
  'deranged','desiccate','desultory','dilapidated','dilettante','diminutive','disavow','disconcert',
  'disparate','dissemble','dogmatic','duplicity','ebullient','egregious','elusive','embroil','empirical',
  'endemic','enervate','enigmatic','ephemeral','equivocal','erudite','esoteric','euphemism','evanescent',
  'exacerbate','excoriate','exemplary','exonerate','expedient','extraneous','fecund','fervent','flagrant',
  'foment','fortuitous','fractious','fraudulent','furtive','garrulous','grandiose','gregarious',
  'hapless','harangue','hegemony','heterogeneous','hubris','hypocritical','iconoclast','idiosyncrasy',
  'ignominious','immutable','imperious','implacable','impudent','inadvertent','incendiary','incorrigible',
  'indomitable','inequitable','inexorable','infallible','ingenuous','insidious','intransigent','inveterate',
  'irascible','labyrinthine','laconic','lethargic','litigious','loquacious','lucid','lugubrious',
  'magnanimous','malevolent','malleable','mendacious','meticulous','misanthrope','mitigate','mundane',
  'nefarious','neologism','nihilism','nonchalant','obdurate','obfuscate','oblique','obstinate','obtuse',
  'odious','omnipotent','omniscient','opaque','ostentatious','ostracize','parsimonious','pedantic',
  'pejorative','pernicious','perspicacious','pervasive','philanthropy','platitude','plausible',
  'polemical','portentous','pragmatic','precarious','predilection','preposterous','presumptuous',
  'prevaricate','probity','procrastinate','profound','proliferate','propitious','provincial','prudent',
  'pugnacious','querulous','ramification','rancorous','rapacious','recalcitrant','recondite',
  'remonstrate','repudiate','resilient','reticent','rhetoric','sanctimonious','sanguine','sardonic',
  'scrupulous','serendipity','solicitous','specious','spurious','squalor','stoic','strident',
  'subjugate','superfluous','sycophant','taciturn','tangential','tenacious','timorous','torpid',
  'transient','trite','truculent','turbulent','ubiquitous','unconscionable','unctuous','utilitarian',
  'vacillate','venerate','verbose','vexatious','vicarious','vindictive','virulent','volatile',
  'wanton','zealous','zeal',
]);
function estimateLevel(word) {
  const w = (word || '').toLowerCase().trim();
  if (CEFR_EASY.has(w)) return 'easy';
  if (CEFR_HARD.has(w)) return 'hard';
  // Fallback: từ rất ngắn (≤3) thường dễ, từ rất dài (≥12) thường khó
  const len = w.length;
  if (len <= 3) return 'easy';
  if (len >= 12) return 'hard';
  return 'medium';
}

function guessCategory(definition, partOfSpeech, meaningVI) {
  const d = (definition || '').toLowerCase();
  const v = (meaningVI || '').toLowerCase();
  if (/feel|emotion|happy|sad|anger|love|fear|joy|grief/.test(d) || /cảm xúc|vui|buồn|giận|sợ|yêu thương/.test(v)) return 'Cảm xúc';
  if (/person|character|behav|personality|trait|manner/.test(d) || /tính cách|tính khí/.test(v)) return 'Tính cách';
  if (/work|job|career|business|profess|office|manage/.test(d) || /công việc|nghề nghiệp/.test(v)) return 'Công việc';
  if (/learn|educat|school|study|knowledge|university|college|campus|academ/.test(d) || /giáo dục|học tập|trường/.test(v)) return 'Giáo dục';
  if (/\bnature\b|plant|animal|\bearth\b|wildlife|forest|ocean|mountain|river/.test(d) || /thiên nhiên|động vật|thực vật/.test(v)) return 'Thiên nhiên';
  if (/speak|talk|language|word|communicat|express/.test(d) || /giao tiếp|nói|ngôn ngữ/.test(v)) return 'Giao tiếp';
  if (/think|idea|mind|philosoph|concept|logic|reason/.test(d) || /triết học|tư tưởng/.test(v)) return 'Triết học';
  if (/travel|journey|place|country|city|trip/.test(d) || /du lịch|chuyến đi/.test(v)) return 'Du lịch';
  if (/food|eat|cook|drink|meal|taste/.test(d) || /ẩm thực|món ăn/.test(v)) return 'Ẩm thực';
  if (/science|technolog|digital|computer|data|system/.test(d) || /công nghệ|khoa học/.test(v)) return 'Công nghệ';
  if (/art|music|paint|creat|design|aesthetic/.test(d) || /nghệ thuật/.test(v)) return 'Nghệ thuật';
  if (/health|medic|body|disease|treatment/.test(d) || /sức khỏe|bệnh/.test(v)) return 'Sức khỏe';
  if (/society|social|culture|community|people/.test(d) || /xã hội|cộng đồng/.test(v)) return 'Xã hội';
  if (mapPartOfSpeech(partOfSpeech) === 'verb') return 'Hành động';
  return 'Cuộc sống';
}

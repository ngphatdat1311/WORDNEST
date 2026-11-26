import type { WordLevel, WordType } from '../types/wordnest.ts';

export interface StarterPackWord {
  word: string;
  phonetic: string;
  meaning: string;
  example: string;
  type: WordType;
  level: WordLevel;
}

export interface StarterPack {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  folderName: string;
  category: string;
  words: StarterPackWord[];
}

export const VOCAB_STARTER_PACKS: StarterPack[] = [
  {
    id: 'pack-daily-a2-b1',
    title: 'Giao Tiếp Hằng Ngày',
    subtitle: '20 từ & cụm từ thiết yếu giúp trò chuyện tự nhiên như người bản xứ.',
    badge: 'A2 – B1',
    folderName: 'Giao tiếp Hằng ngày',
    category: 'Giao tiếp',
    words: [
      { word: 'appreciate', phonetic: '/əˈpriː.ʃi.eɪt/', meaning: 'trân trọng, cảm kích', example: 'I really appreciate your help today.', type: 'verb', level: 'easy' },
      { word: 'convenient', phonetic: '/kənˈviː.ni.ənt/', meaning: 'tiện lợi, thuận tiện', example: 'Is tomorrow morning convenient for you?', type: 'adj', level: 'easy' },
      { word: 'reliable', phonetic: '/rɪˈlaɪ.ə.bəl/', meaning: 'đáng tin cậy', example: 'She is one of the most reliable friends I have.', type: 'adj', level: 'easy' },
      { word: 'recommend', phonetic: '/ˌrek.əˈmend/', meaning: 'gợi ý, đề xuất', example: 'Can you recommend a good coffee shop nearby?', type: 'verb', level: 'easy' },
      { word: 'flexible', phonetic: '/ˈflek.sə.bəl/', meaning: 'linh hoạt, dễ thích nghi', example: 'My schedule is quite flexible this week.', type: 'adj', level: 'medium' },
      { word: 'catch up', phonetic: '/kætʃ ʌp/', meaning: 'gặp gỡ trò chuyện, bắt kịp', example: 'Let us grab coffee soon and catch up!', type: 'phrase', level: 'medium' },
      { word: 'figure out', phonetic: '/ˈfɪɡ.jər aʊt/', meaning: 'tìm ra cách giải quyết, hiểu ra', example: 'We need to figure out why the app is slow.', type: 'phrase', level: 'medium' },
      { word: 'get along', phonetic: '/ɡet əˈlɒŋ/', meaning: 'hòa thuận, thân thiết với nhau', example: 'I get along really well with my new roommates.', type: 'phrase', level: 'medium' },
      { word: 'hesitate', phonetic: '/ˈhez.ɪ.teɪt/', meaning: 'do dự, ngại ngùng', example: 'Please do not hesitate to ask if you have questions.', type: 'verb', level: 'medium' },
      { word: 'reasonable', phonetic: '/ˈriː.zən.ə.bəl/', meaning: 'hợp lý, phải chăng', example: 'The prices at that restaurant are very reasonable.', type: 'adj', level: 'easy' },
      { word: 'affordable', phonetic: '/əˈfɔː.də.bəl/', meaning: 'giá cả vừa túi tiền', example: 'We are looking for an affordable apartment downtown.', type: 'adj', level: 'medium' },
      { word: 'awkward', phonetic: '/ˈɔː.kwəd/', meaning: 'ngượng ngùng, khó xử', example: 'There was an awkward silence after his joke.', type: 'adj', level: 'medium' },
      { word: 'exhausted', phonetic: '/ɪɡˈzɔː.stɪd/', meaning: 'kiệt sức, mệt lử', example: 'I was completely exhausted after the long flight.', type: 'adj', level: 'medium' },
      { word: 'enthusiastic', phonetic: '/ɪnˌθjuː.ziˈæs.tɪk/', meaning: 'nhiệt tình, hào hứng', example: 'The team is very enthusiastic about the new idea.', type: 'adj', level: 'medium' },
      { word: 'grateful', phonetic: '/ˈɡreɪt.fəl/', meaning: 'biết ơn', example: 'I am deeply grateful for all your support.', type: 'adj', level: 'easy' },
      { word: 'overwhelmed', phonetic: '/ˌəʊ.vəˈwelmd/', meaning: 'choáng ngợp, quá tải', example: 'She felt overwhelmed by all the messages.', type: 'adj', level: 'medium' },
      { word: 'worthwhile', phonetic: '/ˌwɜːθˈwaɪl/', meaning: 'đáng công sức, bổ ích', example: 'Learning a new language is always worthwhile.', type: 'adj', level: 'medium' },
      { word: 'make sense', phonetic: '/meɪk sens/', meaning: 'hợp lý, dễ hiểu', example: 'Her explanation finally started to make sense.', type: 'phrase', level: 'easy' },
      { word: 'keep in touch', phonetic: '/kiːp ɪn tʌtʃ/', meaning: 'giữ liên lạc', example: 'Promise me you will keep in touch after moving.', type: 'phrase', level: 'easy' },
      { word: 'mindset', phonetic: '/ˈmaɪnd.set/', meaning: 'tư duy, cách suy nghĩ', example: 'A growth mindset helps you learn from mistakes.', type: 'noun', level: 'medium' },
    ],
  },
  {
    id: 'pack-ielts-b2-c1',
    title: 'IELTS Band 6.5 – 8.0',
    subtitle: '20 từ vựng học thuật ăn điểm cao cho Writing & Speaking IELTS.',
    badge: 'B2 – C1',
    folderName: 'IELTS Academic 7.5+',
    category: 'IELTS',
    words: [
      { word: 'mitigate', phonetic: '/ˈmɪt.ɪ.ɡeɪt/', meaning: 'giảm nhẹ, làm dịu bớt hậu quả', example: 'Green spaces help mitigate urban heat waves.', type: 'verb', level: 'hard' },
      { word: 'ubiquitous', phonetic: '/juːˈbɪk.wɪ.təs/', meaning: 'phổ biến khắp mọi nơi', example: 'Smartphones have become ubiquitous in daily life.', type: 'adj', level: 'hard' },
      { word: 'sustainable', phonetic: '/səˈsteɪ.nə.bəl/', meaning: 'bền vững, thân thiện lâu dài', example: 'Cities must invest in sustainable public transport.', type: 'adj', level: 'medium' },
      { word: 'exacerbate', phonetic: '/ɪɡˈzæs.ə.beɪt/', meaning: 'làm trầm trọng thêm', example: 'Rising housing costs exacerbate social inequality.', type: 'verb', level: 'hard' },
      { word: 'unprecedented', phonetic: '/ʌnˈpres.ɪ.den.tɪd/', meaning: 'chưa từng có tiền lệ', example: 'Remote work grew at an unprecedented pace.', type: 'adj', level: 'hard' },
      { word: 'alleviate', phonetic: '/əˈliː.vi.eɪt/', meaning: 'xoa dịu, giảm bớt (gánh nặng/đau đớn)', example: 'New policies aim to alleviate traffic congestion.', type: 'verb', level: 'hard' },
      { word: 'detrimental', phonetic: '/ˌdet.rɪˈmen.təl/', meaning: 'có hại, gây tổn hại', example: 'Lack of sleep has a detrimental effect on focus.', type: 'adj', level: 'hard' },
      { word: 'viable', phonetic: '/ˈvaɪ.ə.bəl/', meaning: 'khả thi, có thể thực hiện thành công', example: 'Solar power is now a financially viable alternative.', type: 'adj', level: 'medium' },
      { word: 'correlate', phonetic: '/ˈkɒr.ə.leɪt/', meaning: 'tương quan, có mối liên hệ chặt', example: 'Higher literacy rates strongly correlate with income.', type: 'verb', level: 'hard' },
      { word: 'compelling', phonetic: '/kəmˈpel.ɪŋ/', meaning: 'thuyết phục mạnh mẽ, lôi cuốn', example: 'There is compelling evidence supporting early education.', type: 'adj', level: 'hard' },
      { word: 'foster', phonetic: '/ˈfɒs.tər/', meaning: 'nuôi dưỡng, thúc đẩy phát triển', example: 'Open discussions foster creativity in classrooms.', type: 'verb', level: 'medium' },
      { word: 'curtail', phonetic: '/kɜːˈteɪl/', meaning: 'cắt giảm, hạn chế lại', example: 'Governments must curtail carbon emissions rapidly.', type: 'verb', level: 'hard' },
      { word: 'disparity', phonetic: '/dɪˈspær.ə.ti/', meaning: 'sự chênh lệch, bất bình đẳng', example: 'The wealth disparity between regions continues to widen.', type: 'noun', level: 'hard' },
      { word: 'pragmatic', phonetic: '/præɡˈmæt.ɪk/', meaning: 'thực tế, thực dụng hiệu quả', example: 'We need a pragmatic solution rather than vague ideals.', type: 'adj', level: 'hard' },
      { word: 'pivotal', phonetic: '/ˈpɪv.ə.təl/', meaning: 'then chốt, mang tính bước ngoặt', example: 'Teachers play a pivotal role in shaping curiosity.', type: 'adj', level: 'medium' },
      { word: 'catalyst', phonetic: '/ˈkæt.əl.ɪst/', meaning: 'chất xúc tác, động lực thúc đẩy', example: 'The internet acted as a catalyst for global learning.', type: 'noun', level: 'hard' },
      { word: 'indispensable', phonetic: '/ˌɪn.dɪˈspen.sə.bəl/', meaning: 'không thể thiếu được', example: 'Critical thinking is indispensable in the AI era.', type: 'adj', level: 'hard' },
      { word: 'plausible', phonetic: '/ˈplɔː.zə.bəl/', meaning: 'có vẻ hợp lý, đáng tin', example: 'She offered a plausible explanation for the delay.', type: 'adj', level: 'medium' },
      { word: 'scrutinize', phonetic: '/ˈskruː.tɪ.naɪz/', meaning: 'xem xét kỹ lưỡng, soi xét', example: 'Consumers increasingly scrutinize product ingredients.', type: 'verb', level: 'hard' },
      { word: 'paramount', phonetic: '/ˈpær.ə.maʊnt/', meaning: 'tối quan trọng, hàng đầu', example: 'Data privacy is of paramount importance to users.', type: 'adj', level: 'hard' },
    ],
  },
  {
    id: 'pack-toeic-office',
    title: 'TOEIC & Tiếng Anh Công Sở',
    subtitle: '20 từ khóa cốt lõi cho email, họp nhóm, đàm phán và đề thi TOEIC.',
    badge: 'TOEIC 650+',
    folderName: 'TOEIC & Công sở',
    category: 'Công việc',
    words: [
      { word: 'deadline', phonetic: '/ˈded.laɪn/', meaning: 'hạn chót nộp việc', example: 'We worked late to meet the Friday deadline.', type: 'noun', level: 'easy' },
      { word: 'negotiate', phonetic: '/nəˈɡəʊ.ʃi.eɪt/', meaning: 'đàm phán, thương lượng', example: 'Both companies agreed to negotiate better terms.', type: 'verb', level: 'medium' },
      { word: 'implement', phonetic: '/ˈɪm.plɪ.ment/', meaning: 'triển khai, áp dụng vào thực tế', example: 'The team will implement the new workflow next month.', type: 'verb', level: 'medium' },
      { word: 'allocate', phonetic: '/ˈæl.ə.keɪt/', meaning: 'phân bổ (ngân sách, nguồn lực)', example: 'We should allocate more time to user testing.', type: 'verb', level: 'medium' },
      { word: 'proposal', phonetic: '/prəˈpəʊ.zəl/', meaning: 'bản đề xuất, phương án', example: 'The client approved our budget proposal yesterday.', type: 'noun', level: 'medium' },
      { word: 'streamline', phonetic: '/ˈstriːm.laɪn/', meaning: 'tinh gọn, tối ưu quy trình', example: 'Automation helped streamline our onboarding process.', type: 'verb', level: 'medium' },
      { word: 'stakeholder', phonetic: '/ˈsteɪkˌhəʊl.dər/', meaning: 'bên liên quan (khách hàng, cổ đông...)', example: 'All key stakeholders attended the quarterly review.', type: 'noun', level: 'medium' },
      { word: 'agenda', phonetic: '/əˈdʒen.də/', meaning: 'chương trình họp, danh mục việc', example: 'The first item on today’s agenda is product launch.', type: 'noun', level: 'medium' },
      { word: 'reimburse', phonetic: '/ˌriː.ɪmˈbɜːs/', meaning: 'hoàn tiền, thanh toán lại chi phí', example: 'The company will reimburse all travel expenses.', type: 'verb', level: 'medium' },
      { word: 'compliance', phonetic: '/kəmˈplaɪ.əns/', meaning: 'sự tuân thủ quy định', example: 'Strict compliance with safety rules is required.', type: 'noun', level: 'medium' },
      { word: 'benchmark', phonetic: '/ˈbentʃ.mɑːk/', meaning: 'tiêu chuẩn đối chiếu, cột mốc chuẩn', example: 'This product sets a new benchmark for quality.', type: 'noun', level: 'medium' },
      { word: 'milestone', phonetic: '/ˈmaɪl.stəʊn/', meaning: 'cột mốc quan trọng của dự án', example: 'Reaching 10,000 users was a huge milestone for us.', type: 'noun', level: 'medium' },
      { word: 'delegate', phonetic: '/ˈdel.ɪ.ɡeɪt/', meaning: 'ủy quyền, phân công nhiệm vụ', example: 'Good managers know how to delegate effectively.', type: 'verb', level: 'medium' },
      { word: 'consensus', phonetic: '/kənˈsen.səs/', meaning: 'sự đồng thuận chung', example: 'After an hour, the team reached a clear consensus.', type: 'noun', level: 'medium' },
      { word: 'itinerary', phonetic: '/aɪˈtɪn.ər.ər.i/', meaning: 'lịch trình chuyến công tác/du lịch', example: 'Please review the travel itinerary before departure.', type: 'noun', level: 'hard' },
      { word: 'tentative', phonetic: '/ˈten.tə.tɪv/', meaning: 'dự kiến, tạm thời (chưa chốt)', example: 'We have a tentative meeting scheduled for Tuesday.', type: 'adj', level: 'medium' },
      { word: 'proactive', phonetic: '/ˌprəʊˈæk.tɪv/', meaning: 'chủ động đi trước giải quyết', example: 'Taking a proactive approach prevents costly bugs.', type: 'adj', level: 'medium' },
      { word: 'redundant', phonetic: '/rɪˈdʌn.dənt/', meaning: 'dư thừa, không còn cần thiết', example: 'We removed redundant steps from the signup form.', type: 'adj', level: 'medium' },
      { word: 'feasible', phonetic: '/ˈfiː.zə.bəl/', meaning: 'khả thi, làm được trong thực tế', example: 'Launching within two weeks sounds completely feasible.', type: 'adj', level: 'medium' },
      { word: 'escalate', phonetic: '/ˈes.kə.leɪt/', meaning: 'leo thang, chuyển lên cấp cao hơn', example: 'If the issue persists, escalate it to engineering.', type: 'verb', level: 'medium' },
    ],
  },
  {
    id: 'pack-phrasal-verbs',
    title: 'Cụm Động Từ Vàng (Phrasal Verbs)',
    subtitle: '15 cụm động từ xuất hiện dày đặc trong phim ảnh, TED Talks & giao tiếp.',
    badge: 'B1 – B2',
    folderName: 'Cụm Động Từ Vàng',
    category: 'Phrasal Verbs',
    words: [
      { word: 'come up with', phonetic: '/kʌm ʌp wɪð/', meaning: 'nghĩ ra (ý tưởng, giải pháp)', example: 'She came up with a brilliant marketing campaign.', type: 'phrase', level: 'medium' },
      { word: 'put off', phonetic: '/pʊt ɒf/', meaning: 'trì hoãn, dời sang lúc khác', example: 'Stop putting off your English practice until tomorrow.', type: 'phrase', level: 'medium' },
      { word: 'turn down', phonetic: '/tɜːn daʊn/', meaning: 'từ chối (lời mời, đề nghị)', example: 'He turned down the job offer to start his own studio.', type: 'phrase', level: 'medium' },
      { word: 'run out of', phonetic: '/rʌn aʊt əv/', meaning: 'hết sạch, cạn kiệt', example: 'We ran out of coffee right before the deadline.', type: 'phrase', level: 'easy' },
      { word: 'look forward to', phonetic: '/lʊk ˈfɔː.wəd tuː/', meaning: 'mong đợi, háo hức', example: 'I really look forward to seeing you next weekend.', type: 'phrase', level: 'easy' },
      { word: 'carry out', phonetic: '/ˈkær.i aʊt/', meaning: 'tiến hành, thực hiện (nghiên cứu, kế hoạch)', example: 'Scientists carried out an experiment on sleep habits.', type: 'phrase', level: 'medium' },
      { word: 'break down', phonetic: '/breɪk daʊn/', meaning: 'chia nhỏ ra; hoặc bị hỏng (máy móc)', example: 'Break down big tasks into small manageable steps.', type: 'phrase', level: 'medium' },
      { word: 'bring up', phonetic: '/brɪŋ ʌp/', meaning: 'đề cập đến chủ đề; nuôi nấng', example: 'Thanks for bringing up that important point.', type: 'phrase', level: 'medium' },
      { word: 'burn out', phonetic: '/bɜːn aʊt/', meaning: 'kiệt quệ tinh thần vì làm việc quá sức', example: 'Take regular breaks so you do not burn out.', type: 'phrase', level: 'medium' },
      { word: 'call off', phonetic: '/kɔːl ɒf/', meaning: 'hủy bỏ (cuộc họp, sự kiện)', example: 'They had to call off the outdoor concert due to rain.', type: 'phrase', level: 'medium' },
      { word: 'get over', phonetic: '/ɡet ˈəʊ.vər/', meaning: 'vượt qua (nỗi buồn, cú sốc, bệnh)', example: 'It took him weeks to get over the disappointment.', type: 'phrase', level: 'medium' },
      { word: 'keep up with', phonetic: '/kiːp ʌp wɪð/', meaning: 'theo kịp, cập nhật kịp với', example: 'It is hard to keep up with how fast AI evolves.', type: 'phrase', level: 'medium' },
      { word: 'point out', phonetic: '/pɔɪnt aʊt/', meaning: 'chỉ ra, lưu ý một điểm quan trọng', example: 'The reviewer pointed out two subtle edge cases.', type: 'phrase', level: 'medium' },
      { word: 'settle down', phonetic: '/ˈset.əl daʊn/', meaning: 'ổn định cuộc sống; bình tĩnh lại', example: 'After traveling for years, they decided to settle down.', type: 'phrase', level: 'medium' },
      { word: 'work out', phonetic: '/wɜːk aʊt/', meaning: 'tập thể dục; diễn ra suôn sẻ; tìm ra đáp án', example: 'Do not worry—everything will work out in the end.', type: 'phrase', level: 'easy' },
    ],
  },
];

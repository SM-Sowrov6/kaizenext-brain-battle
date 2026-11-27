-- ════════════════════════════════════════════════════════════════
--  Question bank — 20 questions from "Questions for Quiz.docx"
--  (2 each: বাংলা, English, বাংলাদেশ, আন্তর্জাতিক, কম্পিউটার, বিজ্ঞান,
--  ভূগোল, গণিত, মানসিক দক্ষতা, নৈতিকতা).
--  REPLACES the current bank and sets the quiz to 20 questions / 10 minutes.
--  Correct answer = option index in the last column (0 = A … 3 = D).
-- ════════════════════════════════════════════════════════════════
do $$
declare
  v_quiz uuid := (select active_quiz_id from public.event_settings where id = 1);
  v_q    uuid;
  r      record;
  i      int;
begin
  if v_quiz is null then raise exception 'No active quiz configured'; end if;

  -- Remove the old bank: delete questions nobody has seen, archive the rest
  delete from public.questions q
   where q.quiz_id = v_quiz and q.archived_at is null
     and not exists (select 1 from public.participant_answers pa where pa.question_id = q.id)
     and not exists (select 1 from public.attempts a where q.id = any (a.question_ids));
  update public.questions set is_active = false, archived_at = now()
   where quiz_id = v_quiz and archived_at is null;

  for r in
    select * from (values
      (1, 'কাজী নজরুল ইসলামের কোন উপন্যাসের কেন্দ্রীয় চরিত্র জাহাঙ্গীর?', array['বাঁধনহারা', 'মৃত্যুক্ষুধা', 'কুহেলিকা', 'শিউলিমালা'], 2),
      (2, '‘মৃগয়া’ শব্দের মৃগ বলতে কী বোঝানো হয়েছে?', array['বানর', 'সিংহ', 'পশু', 'বন'], 2),
      (3, 'What is the antonym of ''percipience''?', array['shrewdness', 'dullness', 'discerning', 'astuteness'], 1),
      (4, 'Which of these works contains a defence of the right of freedom of speech and expression?', array['Holy Living and Holy Dying', 'Areopagitica', 'Religio Medici', 'A Free Man''s Worship'], 1),
      (5, 'বাংলাদেশের উচ্চফলনশীল (উফশী) জাতের ধান ও গমের নাম যথাক্রমে-', array['হরিধান, রূপালী', 'ইরাটম, বর্ণালী', 'ব্রি-শাইল, বলাকা', 'হীরা, উত্তরণ'], 2),
      (6, 'বাংলাদেশে স্থানীয় সরকার ব্যবস্থা দুর্বল হওয়ার পেছনে সবচেয়ে বড় প্রাতিষ্ঠানিক দ্বন্দ্ব কোনটি?', array['উপজেলা ও ইউনিয়ন পরিষদের মধ্যে দ্বৈত প্রশাসনিক কর্তৃত্ব', 'সংবিধানে আর্থিক ক্ষমতার বিকেন্দ্রীকরণের বিধান থাকা সত্ত্বেও বাস্তবে তা কেন্দ্রীয় সরকারের হাতে অতিকেন্দ্রীভূত', 'পৌরসভা পর্যায়ে সরকারি বেসরকারি অংশীদারিত্বের অভাব', 'দাতা সংস্থাগুলোর মধ্যে সমন্বয়হীনতা'], 1),
      (7, 'কোন ভূ-রাজনৈতিক তত্ত্ব বিশ্ব আধিপত্যের চাবিকাঠি হিসাবে ইউরেশিয়ার নিয়ন্ত্রণকে সমর্থন করে?', array['হার্টল্যান্ড তত্ত্ব', 'ডমিনো তত্ত্ব', 'রিমল্যান্ড তত্ত্ব', 'কন্টেইনমেন্ট তত্ত্ব'], 0),
      (8, 'জলবায়ু কূটনীতিতে ''Common but Differentiated Responsibilities (CBDR)'' নীতি প্রথম কোথায় স্বীকৃতি হয়েছিল?', array['রিও ঘোষণা', 'কিয়োটো প্রটোকল', 'প্যারিস চুক্তি', 'স্টকহোম ঘোষণা'], 0),
      (9, 'Precision Agriculture এ সাধারণত নিচের কোন প্রযুক্তি ব্যবহৃত হয়?', array['ইনফ্রা রেড ইমেজিং', 'আই.ও.টি (IoT), সেন্সর', 'তার মাধ্যম সম্পন্ন নেটওয়ার্ক', 'ও.এল.ই.ডি (OLED), ডিসপ্লে'], 1),
      (10, 'কোনটি কম্বিনেশনাল লজিক সার্কিট নয়?', array['রেজিস্টার', 'ডিকোডার', 'মাল্টিপ্লেক্সার', 'NAND গেট'], 0),
      (11, 'পারমাণবিক চুল্লিতে ''মডারেটরের'' প্রাথমিক কাজ হলো:', array['অতিরিক্ত নিউট্রন শোষণ এবং চেইন বিক্রিয়া নিয়ন্ত্রণ', 'চুল্লির কেন্দ্র থেকে উৎপন্ন তাপ স্থানান্তর করে শীতল করা', 'দ্রুতগতি সম্পন্ন নিউট্রনগুলোকে ধীরগতি করে ফিশনের সম্ভাবনা বাড়ানো', 'ক্ষতিকারক গামা বিকিরণ থেকে সুরক্ষা প্রদান'], 2),
      (12, '‘Necessary evil’ কোনটি?', array['প্রস্বেদন', 'অভিস্রবণ', 'ব্যাপন', 'শোষণ'], 0),
      (13, 'ভঙ্গিল পর্বত, আগ্নেয় পর্বত ও স্তূপ পর্বতের উদাহরণ যথাক্রমে-', array['রকি, ভিসুভিয়াস, ব্ল্যাক ফরেস্ট', 'হিমালয়, আল্পস, রকি', 'হিমালয়, রকি, বিন্দা', 'আল্পস, হেনরী, ফুজিয়ামা'], 0),
      (14, 'বাংলাদেশের ‘দুর্যোগ ব্যবস্থাপনা আইন’ কবে প্রণীত হয়?', array['২০০৫', '২০০৮', '২০১২', '২০১৫'], 2),
      (15, '100 টাকা 10% হারে 5 বছরের জন্য বিনিয়োগ করা হলে, সরল ও চক্রবৃদ্ধি মুনাফার পার্থক্য কত?', array['10.05 টাকা', '11.05 টাকা', '12.05 টাকা', '13.05 টাকা'], 1),
      (16, 'যদি কোনো বর্গক্ষেত্রের প্রত্যেক বাহুর পরিমাণ 10% বৃদ্ধি করা হয়, তবে তার ক্ষেত্রফল শতকরা কত বৃদ্ধি পাবে?', array['20%', '25%', '21%', '16%'], 2),
      (17, 'একটি কঠিন ঘনক অর্ধেক পানির উপরে ও অর্ধেক পানির নিচে ভাসছে। আপনি যদি ঘনকটি পানির মধ্যে ২ সেমি গভীরে ঠেলে দেন এবং তারপর সেটিকে ছেড়ে দেন, তাহলে কি ঘটবে?', array['ঘনকটি পানির ২ সেমি গভীরে থাকবে', 'ঘনকটি সম্পূর্ণভাবে ডুবে যাবে', 'ঘনকটি আবার অর্ধেক ডুবে থাকা ও অর্ধেক ভেসে থাকা অবস্থায় ফিরে আসবে', 'ঘনকটি প্রথমে যতটুকু ভেসে ছিল তার চেয়ে উপরে উঠবে'], 2),
      (18, 'যদি P=16 এবং TAP=37 হয়, তবে CUP= কত?', array['40', '38', '36', '42'], 0),
      (19, 'দুর্বল শাসন ব্যবস্থায় উন্নয়ন প্রকল্প ব্যর্থ হয় কারণ-', array['সম্পদের অভাব', 'নাগরিকের বিরোধিতা', 'সিদ্ধান্ত গ্রহণে স্বচ্ছতা সততার অভাব', 'প্রযুক্তির অভাব'], 2),
      (20, 'টেকসই উন্নয়নের জন্য সু-শাসন অপরিহার্য কারণ এটি-', array['দ্রুত শিল্পায়ন নিশ্চিত করে', 'অর্থনৈতিক প্রবৃদ্ধি ও সামাজিক ন্যায্যতার ভারসাম্য রক্ষা করে', 'জনসংখ্যা হ্রাস করে', 'রাজনৈতিক দ্বন্দ্ব দূর করে'], 1)
    ) as t(pos, prompt, opts, c)
  loop
    insert into public.questions (quiz_id, prompt, marks, position)
    values (v_quiz, r.prompt, 1, r.pos) returning id into v_q;
    for i in 0..3 loop
      insert into public.question_options (question_id, position, text, is_correct)
      values (v_q, i, r.opts[i + 1], i = r.c);
    end loop;
  end loop;

  -- 20 questions per player, 10 minutes (30 s per question)
  update public.quizzes set question_count = 20, duration_seconds = 600 where id = v_quiz;
end $$;

-- Check: expect active_questions = 20, with_one_correct = 20, per_player = 20, minutes = 10
select (select count(*) from public.questions where archived_at is null and is_active) as active_questions,
       (select count(*) from public.questions q where archived_at is null
          and (select count(*) from public.question_options o where o.question_id = q.id and o.is_correct) = 1) as with_one_correct,
       (select question_count from public.quizzes where id = (select active_quiz_id from public.event_settings where id = 1)) as per_player,
       (select duration_seconds / 60 from public.quizzes where id = (select active_quiz_id from public.event_settings where id = 1)) as minutes;

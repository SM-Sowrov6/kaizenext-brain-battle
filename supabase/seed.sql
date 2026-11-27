-- ════════════════════════════════════════════════════════════════
--  Question bank 2026-11-27 — the 10 questions from
--  SAMPLE_10_QUESTIONS_2026-11-27.md (4 hard / 3 medium / 3 easy).
--  Two answer give-aways removed: Q6 bracket hint, Q7 date note on option D.
--  Correct answer = option index in the last column (0 = A … 3 = D).
-- ════════════════════════════════════════════════════════════════
--  OPTIONAL starter bank for a fresh database (after the init migration).

do $$
declare
  v_quiz uuid := (select active_quiz_id from public.event_settings where id = 1);
  v_q    uuid;
  r      record;
  i      int;
begin
  if v_quiz is null then raise exception 'No active quiz configured'; end if;

  for r in
    select * from (values
      (1, 'খুলনার নিউজপ্রিন্ট মিল কাঁচামাল হিসাবে ব্যবহার করে –', array['সেগুন কাঠ', 'সুন্দরী কাঠ', 'গেওয়া কাঠ', 'বাঁশ'], 2),
      (2, 'গোলকৃমি কোন অংশ স্ফীত হয়ে সেমিনাল রিসেন্ট্যাকলে পরিণত হয়?', array['ডিম্বাশয়', 'শুক্রাশয়', 'অস্ত্র', 'ডিম্বনালী'], 3),
      (3, 'চট্টগ্রাম বিশ্ববিদ্যালয়ের সর্বপ্রথম উপাচার্য কে?', array['ড. এ. আর. মল্লিক', 'অধ্যাপক আবুল ফজল', 'ড. এম. ইন্নাস আলী', 'ড. আব্দুল করিম'], 0),
      (4, '''জুলে রিমে'' কোন দেশের অধিবাসী ছিলেন?', array['ফরাসি', 'ব্রাজিল', 'জার্মানি', 'আর্জেন্টিনা'], 0),
      (5, 'সাধু রীতিতে কোন পদটির দীর্ঘরূপ হয় না?', array['বিশেষ্য', 'সর্বনাম', 'অব্যয়', 'ক্রিয়া'], 2),
      (6, 'Lions are extremely good --- weighing --- their odds of success in terms of the number of themselves versus the number roaring from a loudspeaker.', array['in, at', 'at, up', 'out, by', 'at, in'], 1),
      (7, 'বাংলাদেশে দৈনিক সর্বোচ্চ বিদ্যুৎ উৎপাদন কত মেগাওয়াট?', array['১০৯৫৮', '১১,৬২৩', '১২৪৯৪', '১৫,৬৪৮'], 3),
      (8, 'Anis and Rafique ..... the floor.', array['would clean', 'clean', 'cleaned', 'to be cleaned'], 1),
      (9, 'শীতল রক্তবিশিষ্ট একটি প্রাণী?', array['হাঙর', 'পেঙ্গুইন', 'কবুতর', 'ব্যাঙ'], 3),
      (10, 'বাংলাদেশের জাতীয় সংসদে উত্থাপিত সরকারি বিল বলতে কী বুঝায়?', array['স্পিকারের বিল', 'সংসদ সদস্যগণ কর্তৃক উত্থাপিত বিল', 'মন্ত্রীগণ কর্তৃক উত্থাপিত বিল', 'সরকার দলীয় সংসদ সদস্যগণ কর্তৃক উত্থাপিত বিল'], 2)
    ) as t(pos, prompt, opts, c)
  loop
    insert into public.questions (quiz_id, prompt, marks, position)
    values (v_quiz, r.prompt, 1, r.pos) returning id into v_q;
    for i in 0..3 loop
      insert into public.question_options (question_id, position, text, is_correct)
      values (v_q, i, r.opts[i + 1], i = r.c);
    end loop;
  end loop;
end $$;

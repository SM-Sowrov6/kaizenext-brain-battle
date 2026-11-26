-- ════════════════════════════════════════════════════════════════
--  OPTIONAL starter question bank for Brain Battle.
--  Run once in the SQL editor (or `supabase db reset` locally).
--  Edit / replace everything from the Admin → Questions screen.
--  Correct answer = the option index in `c` (0 = A … 3 = D).
-- ════════════════════════════════════════════════════════════════
do $$
declare
  v_quiz uuid := (select active_quiz_id from public.event_settings where id = 1);
  v_q    uuid;
  r      record;
  i      int;
begin
  for r in
    select * from (values
      (1,  'What does "AI" stand for in technology?', array['Automated Interface','Artificial Intelligence','Advanced Internet','Algorithmic Integration'], 1),
      (2,  'Which company developed the Android operating system (acquired in 2005)?', array['Apple','Microsoft','Google','Samsung'], 2),
      (3,  'Which language is primarily used to style web pages?', array['HTML','Python','CSS','SQL'], 2),
      (4,  'What does "SQL" stand for?', array['Structured Query Language','Simple Question Logic','Sequential Query Layer','System Query Link'], 0),
      (5,  'Which data structure works on the First-In, First-Out (FIFO) principle?', array['Stack','Queue','Tree','Graph'], 1),
      (6,  'In machine learning, what is "overfitting"?', array['A model that is too small to learn','A model that memorises training data and generalises poorly','A model that trains too fast','A model with no parameters'], 1),
      (7,  'What is the binary representation of the decimal number 10?', array['1010','1100','1001','0110'], 0),
      (8,  'Which of these is NOT a programming language?', array['Rust','Kotlin','Figma','Go'], 2),
      (9,  'What does "HTTP" stand for?', array['HyperText Transfer Protocol','High Transfer Text Process','Hyperlink Text Transmission Program','Host Transfer Type Protocol'], 0),
      (10, 'What is the capital of Bangladesh?', array['Chattogram','Khulna','Sylhet','Dhaka'], 3),
      (11, 'What is the best first step when preparing for a job interview?', array['Memorise random facts','Research the company and the role','Skip reading the job description','Arrive without a CV'], 1),
      (12, 'Which of these is a version control system?', array['Docker','Git','Nginx','Redis'], 1),
      (13, 'What does "UI" stand for in product design?', array['Universal Integration','User Interface','Unified Input','User Interaction Index'], 1),
      (14, 'Which number comes next: 2, 6, 12, 20, 30, ?', array['40','42','36','44'], 1),
      (15, 'Which one is a cloud computing platform?', array['AWS','HTML5','Photoshop','Excel'], 0),
      (16, 'What does "CPU" stand for?', array['Central Processing Unit','Computer Personal Unit','Core Program Utility','Central Power Unit'], 0),
      (17, 'Which time complexity describes binary search on a sorted array?', array['O(n)','O(n²)','O(log n)','O(1)'], 2),
      (18, 'A soft skill that employers value most in teams is:', array['Typing speed','Communication','Memorising syntax','Owning many gadgets'], 1),
      (19, 'Which river is the longest flowing through Bangladesh?', array['Padma','Meghna','Jamuna','Karnaphuli'], 0),
      (20, 'If a task takes 3 people 6 days, how long does it take 6 people (same pace)?', array['12 days','3 days','2 days','9 days'], 1)
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

-- ============================================================
-- Abilene Vibes — Migrate starterJobListings → job_listings
-- Safe to run multiple times (WHERE NOT EXISTS = no duplicates)
-- ============================================================

-- 1. Restaurant Server
INSERT INTO public.job_listings
  (title, company, category, job_type, pay_label, location, phone, email, description, requirements, image_data, plan, status, app_method, duration)
SELECT
  'Restaurant Server',
  'Abilene Restaurant',
  'Restaurant & Food',
  'Part Time',
  'Hourly + Tips',
  'Abilene, TX',
  '(325) 555-0412',
  'hiring@abilenerestaurant.com',
  'Dinner service, guest support, table care, and team closing duties. Greet guests, take orders accurately, serve food and beverages, and ensure a great dining experience from start to finish.',
  'Friendly attitude, ability to stand for long periods. Prior experience a plus but not required.',
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80',
  'free',
  'approved',
  'Phone',
  '30 Days'
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_listings WHERE title = 'Restaurant Server' AND company = 'Abilene Restaurant'
);

-- 2. Construction Laborer
INSERT INTO public.job_listings
  (title, company, category, job_type, pay_label, location, phone, email, description, requirements, image_data, plan, status, app_method, duration)
SELECT
  'Construction Laborer',
  'Abilene Build Crew',
  'Construction',
  'Full Time',
  '$17-$22/hr',
  'Abilene, TX',
  '(325) 555-0517',
  'jobs@abilenebuilds.com',
  'Site cleanup, materials handling, framing support, and general construction help on residential and commercial projects across Abilene.',
  'Reliable and punctual. Steel-toed boots required. No experience needed — will train.',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
  'free',
  'approved',
  'Phone',
  '30 Days'
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_listings WHERE title = 'Construction Laborer' AND company = 'Abilene Build Crew'
);

-- 3. Cashier / Sales Associate
INSERT INTO public.job_listings
  (title, company, category, job_type, pay_label, location, phone, email, description, requirements, image_data, plan, status, app_method, duration)
SELECT
  'Cashier / Sales Associate',
  'Local Retail Store',
  'Retail',
  'Part Time',
  'Starting at $14/hr',
  'Abilene, TX',
  '(325) 555-0221',
  'store@localretailabilene.com',
  'Help customers find what they need, run checkout, organize merchandise, and keep the sales floor clean and stocked.',
  'Customer service mindset, basic math skills, reliable transportation.',
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80',
  'free',
  'approved',
  'Phone',
  '30 Days'
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_listings WHERE title = 'Cashier / Sales Associate' AND company = 'Local Retail Store'
);

-- 4. Delivery Driver
INSERT INTO public.job_listings
  (title, company, category, job_type, pay_label, location, phone, email, description, requirements, image_data, plan, status, app_method, duration)
SELECT
  'Delivery Driver',
  'Local Delivery Service',
  'Driving & Delivery',
  'Full Time',
  '$18/hr',
  'Abilene, TX',
  '(325) 555-0318',
  'dispatch@localdeliveryabilene.com',
  'Drive local delivery routes, handle packages carefully, and ensure on-time drop-offs to residential and business customers throughout Abilene.',
  'Valid TX driver''s license, clean driving record, ability to lift up to 50 lbs.',
  'https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=800&q=80',
  'free',
  'approved',
  'Phone',
  '30 Days'
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_listings WHERE title = 'Delivery Driver' AND company = 'Local Delivery Service'
);

-- 5. Medical Assistant
INSERT INTO public.job_listings
  (title, company, category, job_type, pay_label, location, phone, email, description, requirements, image_data, plan, status, app_method, duration)
SELECT
  'Medical Assistant',
  'Abilene Health Clinic',
  'Health Care',
  'Full Time',
  '$17-$20/hr',
  'Abilene, TX',
  '(325) 555-0720',
  'careers@abilenehealthclinic.com',
  'Patient intake, recording vitals, scheduling appointments, and clinical support in a fast-paced local health clinic.',
  'Medical Assistant certification preferred. Strong communication skills, compassion for patients.',
  'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80',
  'free',
  'approved',
  'Phone',
  '30 Days'
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_listings WHERE title = 'Medical Assistant' AND company = 'Abilene Health Clinic'
);

-- 6. Office Administrator
INSERT INTO public.job_listings
  (title, company, category, job_type, pay_label, location, phone, email, description, requirements, image_data, plan, status, app_method, duration)
SELECT
  'Office Administrator',
  'Local Business Office',
  'Office/Admin',
  'Part Time',
  '$16/hr',
  'Abilene, TX',
  '(325) 555-0614',
  'office@localbizabilene.com',
  'Answer phones, manage scheduling, handle filing, follow up with customers, and provide general daily office support.',
  'Basic computer skills (Word, email), organized, professional demeanor. No prior experience required.',
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80',
  'free',
  'approved',
  'Phone',
  '30 Days'
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_listings WHERE title = 'Office Administrator' AND company = 'Local Business Office'
);

-- 7. Warehouse Associate
INSERT INTO public.job_listings
  (title, company, category, job_type, pay_label, location, phone, email, description, requirements, image_data, plan, status, app_method, duration)
SELECT
  'Warehouse Associate',
  'Abilene Distribution',
  'Warehouse',
  'Full Time',
  '$15-$17/hr',
  'Abilene, TX',
  '(325) 555-0832',
  'warehouse@abilenedist.com',
  'Receive inbound shipments, sort, pack, and ship orders in a clean organized warehouse facility.',
  'Ability to lift up to 60 lbs, stand for extended periods, follow safety protocols. No experience needed.',
  'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80',
  'free',
  'approved',
  'Phone',
  '30 Days'
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_listings WHERE title = 'Warehouse Associate' AND company = 'Abilene Distribution'
);

-- 8. Customer Service Rep
INSERT INTO public.job_listings
  (title, company, category, job_type, pay_label, location, phone, email, description, requirements, image_data, plan, status, app_method, duration)
SELECT
  'Customer Service Rep',
  'Local Business',
  'Customer Service',
  'Full Time',
  '$14-$16/hr',
  'Abilene, TX',
  '(325) 555-0941',
  'support@localbizabilene.com',
  'Answer inbound calls and messages, resolve customer issues, and help clients get the help they need quickly and professionally.',
  'Good communication skills, patience, basic computer proficiency. Training provided.',
  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=800&q=80',
  'free',
  'approved',
  'Phone',
  '30 Days'
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_listings WHERE title = 'Customer Service Rep' AND company = 'Local Business'
);

-- 9. Production Operator
INSERT INTO public.job_listings
  (title, company, category, job_type, pay_label, location, phone, email, description, requirements, image_data, plan, status, app_method, duration)
SELECT
  'Production Operator',
  'Abilene Manufacturing Co.',
  'Manufacturing',
  'Full Time',
  '$16-$19/hr',
  'Abilene, TX',
  '(325) 555-1020',
  'hr@abilenemanufacturing.com',
  'Operate and monitor production equipment, perform quality checks, and help keep assembly lines running efficiently and safely.',
  'Attention to detail, physical stamina, ability to follow instructions. Manufacturing experience a plus.',
  'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&w=800&q=80',
  'free',
  'approved',
  'Phone',
  '30 Days'
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_listings WHERE title = 'Production Operator' AND company = 'Abilene Manufacturing Co.'
);

-- 10. Electrician Helper
INSERT INTO public.job_listings
  (title, company, category, job_type, pay_label, location, phone, email, description, requirements, image_data, plan, status, app_method, duration)
SELECT
  'Electrician Helper',
  'West Texas Electric',
  'Skilled Trades',
  'Full Time',
  '$18-$24/hr',
  'Abilene, TX',
  '(325) 555-1137',
  'apply@westtexaselectric.com',
  'Assist a licensed electrician with residential and commercial wiring, panel work, and electrical installations across the Abilene area.',
  'Valid driver''s license, willingness to learn, basic hand tool knowledge. Apprenticeship path available.',
  'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80',
  'free',
  'approved',
  'Phone',
  '30 Days'
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_listings WHERE title = 'Electrician Helper' AND company = 'West Texas Electric'
);

-- Verify
SELECT id, title, company, category, job_type, pay_label, status
FROM public.job_listings
ORDER BY created_at DESC
LIMIT 20;

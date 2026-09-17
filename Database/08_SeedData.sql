-- 未收到校方正式節次表，先只建立節次，不臆造上課時間。
INSERT INTO public."TblP126Period"("Period") SELECT generate_series(1,12) ON CONFLICT DO NOTHING;

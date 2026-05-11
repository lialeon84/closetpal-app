CREATE TABLE outfit_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  clothing_item_id UUID REFERENCES clothing_items(id) ON DELETE CASCADE,
  outfit_combo_key TEXT,
  feedback_type TEXT CHECK (feedback_type IN ('dislike_item', 'dislike_outfit')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_outfit_feedback_user_id ON outfit_feedback(user_id);

ALTER TABLE outfit_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own feedback"
ON outfit_feedback
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

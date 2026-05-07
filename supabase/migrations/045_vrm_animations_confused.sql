-- Add 'confused' to the allowed expression values for vrm_animations

ALTER TABLE vrm_animations
  DROP CONSTRAINT vrm_animations_expression_check;

ALTER TABLE vrm_animations
  ADD CONSTRAINT vrm_animations_expression_check
    CHECK (expression IN ('neutral','happy','sad','angry','surprised','relaxed','thinking','confused'));

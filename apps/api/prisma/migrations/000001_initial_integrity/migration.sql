CREATE UNIQUE INDEX conversation_assignments_one_active_per_thread
  ON conversation_assignments(thread_id)
  WHERE status = 'active';

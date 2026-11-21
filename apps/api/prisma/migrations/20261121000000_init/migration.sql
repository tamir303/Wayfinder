-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "engine" TEXT NOT NULL,
    "cache_hit" BOOLEAN NOT NULL,
    "credits" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_logs_user_id_created_at_idx" ON "search_logs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "search_logs" ADD CONSTRAINT "search_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Link profiles to Supabase auth users
ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_id_auth_users_fkey"
  FOREIGN KEY ("id") REFERENCES auth.users("id") ON DELETE CASCADE;

-- Create a profile row whenever a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Row Level Security
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON "profiles"
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- search_logs: RLS on with no policies. Only the API's database role
-- (which bypasses RLS) can read or write it.
ALTER TABLE "search_logs" ENABLE ROW LEVEL SECURITY;

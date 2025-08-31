import 'dotenv/config';

console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("Anon:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0,10) + "...");
console.log("Service:", process.env.SUPABASE_SERVICE_ROLE?.slice(0,10) + "...");

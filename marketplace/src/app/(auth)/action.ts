'use me' // or 'use server'
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;
  const role = formData.get('role') as string || 'buyer'; // Default to buyer

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role, // Picked up by the SQL trigger we created earlier
      },
    },
  });

  if (error) {
    return redirect('/signup?error=' + encodeURIComponent(error.message));
  }

  return redirect('/marketplace');
}
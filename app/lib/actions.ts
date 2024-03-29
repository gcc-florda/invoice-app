'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import {getUser, getUsersEmails} from '@/app/lib/data';
import { v4 as uuidv4 } from 'uuid';
const { db } = require('@vercel/postgres');
const bcrypt = require('bcrypt');

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0.' }), //coerce = change
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

// This is temporary until @types/react-dom is updated --> It wont be used in the createInvoice function (it is required)
export type State = {
    errors?: {
      customerId?: string[];
      amount?: string[];
      status?: string[];
    };
    message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
    const validatedFields  = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }

    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try {
        await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
    }
    catch (e) {
        return {message: 'Database Error: Failed to Create Invoice.',};
    }

    // Purge cached data on-demand for a specific path.
    // Once the database has been updated, the /dashboard/invoices path will be revalidated, 
    // and fresh data will be fetched from the server.
    revalidatePath('/dashboard/invoices'); // otherwise you wont see se new invoice added to the list
    redirect('/dashboard/invoices');
}

export async function updateInvoice(id: string, prevState: State, formData: FormData) {
    const validatedFields  = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }
   
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
   
    try {
        await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
    `;
    } catch (e) {
        return { message: 'Database Error: Failed to Update Invoice.' };
    }
   
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
  }

  export async function deleteInvoice(id: string) {
    // throw new Error('Failed to Delete Invoice');

    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices');
        return { message: 'Deleted Invoice.' };
    } catch (error) {
        return { message: 'Database Error: Failed to Delete Invoice.' };
    }
  }

  export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
  ) {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
            case 'CredentialsSignin':
                return 'Invalid credentials.';
            default:
                return 'Something went wrong.';
            }
        }
      throw error;
    }
  }

  export async function registerUser(
    prevState: string | undefined,
    formData: FormData) {
        try {
            const newUserName = formData.get('user')?.toString();
            const newUserEmail = formData.get('email')?.toString();
            const newUserPassword = formData.get('password')?.toString();
            
            const data = await getUsersEmails();

            var userFound = false;

            data.map((user) => { 
                if (user.email === newUserEmail) {
                userFound = true;
                return;
                } 
            });

            if (userFound) return undefined;

            // Register User

            const userId: string = uuidv4();
            const hashedPassword = await bcrypt.hash(newUserPassword, 10);

            const client = await db.connect();

            console.log(userId, newUserName, newUserEmail, hashedPassword);

            await client.sql`
                INSERT INTO users (id, name, email, password)
                VALUES (${userId}, ${newUserName}, ${newUserEmail}, ${hashedPassword})
                ON CONFLICT (id) DO NOTHING;
            `;

            await client.end();

            await signIn('credentials', formData);

        }
        catch (e) {
            // throw new Error('Failed to register user.');
            throw e;
        }
  }
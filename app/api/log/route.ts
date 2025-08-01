// app/api/log/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Logged event:', JSON.stringify(body, null, 2));
    return NextResponse.json({ success: true, message: 'Event logged' }, { status: 200 });
  } catch (error: unknown) {
  console.error("Log error:", error instanceof Error ? error.message : String(error));
  return NextResponse.json({ error: "Unable to fetch insights" }, { status: 500 });
  }
}
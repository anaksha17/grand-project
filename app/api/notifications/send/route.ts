// app/api/notifications/send/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {type, message, userEmail } = body;
    
    console.log('Notification request:', JSON.stringify(body, null, 2));
    
    // Log different types of notifications
    if (type === 'support') {
      console.log(`Support notification sent to ${userEmail}: ${message}`);
    } else if (type === 'stress_relief') {
      console.log(`Stress relief notification sent to ${userEmail}: ${message}`);
    } else {
      console.log(`${type} notification sent to ${userEmail}: ${message}`);
    }
    
    const response = {
      success: true,
      message: `${type} notification sent successfully`,
      notificationType: type,
      sentAt: new Date().toISOString()
    };
    
    return NextResponse.json(response, { status: 200 });

  }  catch (error: unknown) {
    console.error("Notification Error", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Unable to fetch insights" }, { status: 500 });
  }
}
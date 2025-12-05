import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { portraitQueries } from '@/lib/db';
import { GCSStorageService } from '../../../../src/services/gcs-storage.service';

export async function POST(request: NextRequest) {
  try {
    // Validate database queries are available
    if (!portraitQueries?.create) {
      console.error('Database not properly initialized');
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    // Generate unique filename
    const id = uuidv4();
    const ext = path.extname(file.name);
    const filename = `portrait-${id}${ext}`;
    const localFilepath = path.join(uploadsDir, filename);

    // Save file locally first
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(localFilepath, buffer);

    // Upload to GCS and get public URL
    const gcs = new GCSStorageService();
    const publicUrl = await gcs.uploadImage(localFilepath, filename);

    // Delete local file after upload (optional - keep if you want local backup)
    // await unlink(localFilepath);

    // Save to database with GCS URL
    portraitQueries.create.run(id, filename, publicUrl, null, 0);

    return NextResponse.json({
      id,
      filename,
      filepath: publicUrl  // Return the GCS public URL
    });
  } catch (error) {
    console.error('Portrait upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Validate database queries are available
    if (!portraitQueries?.getAll) {
      console.error('Database not properly initialized: portraitQueries.getAll is undefined');
      return NextResponse.json({ portraits: [] });
    }

    const portraits = portraitQueries.getAll.all();
    return NextResponse.json({ portraits });
  } catch (error) {
    console.error('Get portraits error:', error);
    return NextResponse.json({ error: 'Failed to get portraits' }, { status: 500 });
  }
}

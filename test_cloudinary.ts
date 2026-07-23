// Test script to check Cloudinary upload preset names for dg0kseu3

const presetsToTest = ['Gallery_Uploads', 'gallery_uploads', 'ml_default', 'unsigned', 'diva_uploads', 'default'];

async function testPresets() {
  const sampleDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  for (const preset of presetsToTest) {
    const formData = new FormData();
    formData.append('file', sampleDataUrl);
    formData.append('upload_preset', preset);
    formData.append('folder', 'galleries/test-gallery');

    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/dg0kseu3/image/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (res.ok) {
        console.log(`✅ SUCCESS with preset: "${preset}"!`);
        console.log('   Public ID:', json.public_id);
        console.log('   URL:', json.secure_url);
        return preset;
      } else {
        console.log(`❌ Failed with preset "${preset}":`, json.error?.message);
      }
    } catch (err) {
      console.log(`❌ Error testing "${preset}":`, err);
    }
  }
}

testPresets();

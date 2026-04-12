/**
 * Icon Generation Script
 *
 * Prerequisites:
 *   npm install sharp png-to-ico
 *
 * Usage:
 *   node scripts/generate-icons.js
 *
 * This script converts the SVG icon to PNG files of various sizes
 * and generates .ico file for Windows.
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  let sharp, pngToIco;

  try {
    sharp = require('sharp');
  } catch (e) {
    console.log('Please install sharp: npm install sharp');
    process.exit(1);
  }

  const svgPath = path.join(__dirname, '../assets/icons/icon.svg');
  const outputDir = path.join(__dirname, '../assets/icons');

  if (!fs.existsSync(svgPath)) {
    console.error('SVG icon not found at:', svgPath);
    process.exit(1);
  }

  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
  const pngFiles = [];

  console.log('Generating PNG icons...');

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}.png`);
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  Created: icon-${size}.png`);
    pngFiles.push(outputPath);
  }

  // Also create a plain icon.png at 512px
  const iconPngPath = path.join(outputDir, 'icon.png');
  await sharp(svgPath)
    .resize(512, 512)
    .png()
    .toFile(iconPngPath);
  console.log('  Created: icon.png (512x512)');

  // Create tray icon at 16px and 32px (for high DPI)
  const trayPath = path.join(outputDir, 'tray.png');
  await sharp(svgPath)
    .resize(16, 16)
    .png()
    .toFile(trayPath);
  console.log('  Created: tray.png (16x16)');

  const tray32Path = path.join(outputDir, 'tray@2x.png');
  await sharp(svgPath)
    .resize(32, 32)
    .png()
    .toFile(tray32Path);
  console.log('  Created: tray@2x.png (32x32)');

  // Try to create ICO file
  try {
    const pngToIcoModule = require('png-to-ico');
    // Handle both default export and named export
    pngToIco = pngToIcoModule.default || pngToIcoModule;
    const icoSizes = [16, 32, 48, 256].map(s => path.join(outputDir, `icon-${s}.png`));
    const ico = await pngToIco(icoSizes);
    fs.writeFileSync(path.join(outputDir, 'icon.ico'), ico);
    console.log('  Created: icon.ico');
  } catch (e) {
    console.log('  Note: png-to-ico error:', e.message);
    console.log('  Install png-to-ico for ICO generation: npm install png-to-ico');
  }

  console.log('\nIcon generation complete!');
  console.log('\nFor macOS .icns, use:');
  console.log('  - macOS: iconutil or Xcode');
  console.log('  - Or electron-builder will auto-convert PNG to ICNS');
}

generateIcons().catch(console.error);

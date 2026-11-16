import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const input=process.argv[2];if(!input)throw new Error('Pass the generated image path as the only argument.');
await mkdir('public/images/home',{recursive:true});
await sharp(resolve(input)).resize({width:1672,withoutEnlargement:true}).webp({quality:84,effort:6}).toFile('public/images/home/emergency-logistics.webp');
await sharp(resolve(input)).resize({width:800,withoutEnlargement:true}).webp({quality:82,effort:6}).toFile('public/images/home/emergency-logistics-800.webp');
console.log('Optimized Home artwork saved as responsive WebP assets.');

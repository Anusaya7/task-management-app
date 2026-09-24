const fs = require('fs');
const path = require('path');

// Create .env.local file
const envContent = `MONGODB_URI=your_mongodb_connection_string
`;

const envPath = path.join(__dirname, '.env.local');

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env.local file');
} else {
  console.log('⚠️ .env.local already exists');
}

console.log('🚀 Next.js migration setup complete!');
console.log('📝 Please run: npm install && npm run dev');

import bcrypt from 'bcrypt';

const password = process.argv.slice(2).join(' ').trim();
if (!password) {
  console.error('Usage: npm run security:hash-password -- "your-admin-password"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log(hash);
console.log('\nPut this in backend/.env as ADMIN_PASSWORD_HASH and remove ADMIN_PASSWORD.');

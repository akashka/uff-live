import mongoose from 'mongoose';
import connectDB from '../src/lib/db';
import RateMaster from '../src/lib/models/RateMaster';

async function check() {
  await connectDB();
  
  const rates = await RateMaster.find({ isActive: true }).limit(5);
  console.log('Active RateMasters Sample:');
  rates.forEach(r => {
    console.log(`- ID: ${r._id}, Name: ${r.name}`);
    console.log(`  - Branch/Dept Rates: ${JSON.stringify(r.branchDepartmentRates || [])}`);
    console.log(`  - Branch Rates: ${JSON.stringify(r.branchRates || [])}`);
  });

  await mongoose.disconnect();
}

check().catch(console.error);

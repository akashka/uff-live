import mongoose from 'mongoose';
import connectDB from '../src/lib/db';
import Department from '../src/lib/models/Department';

async function check() {
  await connectDB();
  
  const allDepts = await Department.find({});
  console.log('Total Departments in DB:', allDepts.length);
  allDepts.forEach(d => {
    console.log(`- ID: ${d._id}, Name: ${d.name}, isActive: ${d.isActive}`);
  });

  const activeDepts = await Department.find({ isActive: true });
  console.log('Active Departments in DB (isActive: true):', activeDepts.length);

  await mongoose.disconnect();
}

check().catch(console.error);

#!/usr/bin/env python3
"""
Script to set password for a specific salon
Usage: python set_salon_password.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Initialize password context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

async def set_password():
    phone = "+917503070727"
    password = "Rohit@123"
    
    # Hash password
    password_hash = pwd_context.hash(password)
    
    # Update salon
    result = await db.salons.update_one(
        {"phone": phone},
        {"$set": {"password_hash": password_hash}}
    )
    
    if result.matched_count > 0:
        print(f"✅ Password set successfully for salon: {phone}")
        print(f"Password: {password}")
    else:
        print(f"❌ Salon not found with phone: {phone}")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(set_password())

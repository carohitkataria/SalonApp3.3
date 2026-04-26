"""Script to update existing services with categories and thumbnails"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client.salonhub

# Category thumbnail mappings
CATEGORY_THUMBNAILS = {
    "Hair Treatments": "https://images.unsplash.com/photo-1593702275687-f8b402bf1fb5?w=200&h=200&fit=crop",
    "Massage & Spa": "https://images.unsplash.com/photo-1639162906614-0603b0ae95fd?w=200&h=200&fit=crop",
    "Men's Grooming": "https://images.unsplash.com/photo-1700760934268-8aa0ef52ce0a?w=200&h=200&fit=crop",
    "Manicure & Pedicure": "https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=200&h=200&fit=crop",
    "Waxing & Threading": "https://images.pexels.com/photos/16120497/pexels-photo-16120497.jpeg?w=200&h=200&fit=crop",
    "General": "https://images.unsplash.com/photo-1634449571010-02389ed0f9b0?w=200&h=200&fit=crop",
    "Packages": "https://images.unsplash.com/photo-1633681926035-ec1ac984418a?w=200&h=200&fit=crop",
    "Facial": "https://images.pexels.com/photos/16120497/pexels-photo-16120497.jpeg?w=200&h=200&fit=crop"
}

# Service to category mapping
SERVICE_CATEGORIES = {
    "Haircut": "Men's Grooming",
    "Beard Trim": "Men's Grooming", 
    "Shave": "Men's Grooming",
    "Hair Color": "Hair Treatments",
    "Hair Spa": "Hair Treatments",
    "Facial": "Facial",
    "Head Massage": "Massage & Spa",
    "Pedicure": "Manicure & Pedicure",
    "Manicure": "Manicure & Pedicure",
    "Waxing": "Waxing & Threading"
}

async def update_services():
    services = await db.services.find({}, {"_id": 0}).to_list(100)
    
    for service in services:
        service_name = service.get("service_name", "")
        
        # Get category
        category = SERVICE_CATEGORIES.get(service_name, "General")
        
        # Get thumbnail for category
        thumbnail = CATEGORY_THUMBNAILS.get(category, CATEGORY_THUMBNAILS["General"])
        
        # Update service
        await db.services.update_one(
            {"id": service["id"]},
            {"$set": {
                "category": category,
                "thumbnail_url": thumbnail
            }}
        )
        print(f"Updated {service_name}: category={category}")
    
    print("\nDone! All services updated with categories and thumbnails.")

if __name__ == "__main__":
    asyncio.run(update_services())

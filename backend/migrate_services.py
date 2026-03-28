"""
Migration script to update existing services with new fields
Adds: category, gender_tag, price_type, images, is_favorite
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

# Service category mapping based on keywords
CATEGORY_KEYWORDS = {
    "Clean Up": ["cleanup", "clean up"],
    "Facial": ["facial", "face"],
    "Advance Facial": ["advance facial", "gold facial", "diamond facial", "wine facial", "kanpeki"],
    "Menicure": ["menicure", "manicure"],
    "Pedicure": ["pedicure"],
    "Hair Cut": ["hair cut", "haircut", "baby girl hair cut"],
    "Hair Styling": ["blow dry", "pressing", "curl", "hairstyle", "hair style"],
    "Makeup": ["makeup", "bridal makeup", "party makeup", "haldi makeup", "engagement makeup"],
    "Hair Treatment": ["hair treatment", "hair spa", "anti hair fall", "dandruff", "keraplexid", "rebonding", "smoathming", "botox", "kerasmooth", "nenoplast"],
    "Hair Spa": ["hair spa"],
    "Hair Colour": ["hair colour", "hair color", "streaks", "touchup", "global"],
    "Normal Waxing": ["normal waxing", "waxing"],
    "Rica Waxing": ["rica waxing", "rica"],
    "Body Care": ["head massage", "foot massage", "back massage", "body polishing", "body bleach", "body d tan"],
    "Massage": ["massage"],
    "Bleach": ["bleach"],
    "Face Treatments": ["eye treatment", "pimples", "pigmentation", "skin lightning"],
    "Shampoo": ["shampoo", "sampoo", "conditioning"],
    "Threading": ["threading"]
}

def categorize_service(service_name):
    """Determine category based on service name"""
    service_lower = service_name.lower()
    
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in service_lower:
                return category
    
    return "General"

def determine_gender(service_name):
    """Determine gender tag based on service name"""
    service_lower = service_name.lower()
    
    # Men-specific keywords
    men_keywords = ["beard", "shaving", "shave"]
    # Women-specific keywords
    women_keywords = ["bridal", "bridle", "women", "mahendi", "haldi"]
    
    for keyword in women_keywords:
        if keyword in service_lower:
            return "Women"
    
    for keyword in men_keywords:
        if keyword in service_lower:
            return "Men"
    
    return "Unisex"

async def migrate_services():
    """Update existing services with new fields"""
    # Load environment variables
    ROOT_DIR = Path(__file__).parent
    load_dotenv(ROOT_DIR / '.env')
    
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'test_database')]
    
    print("Starting service migration...")
    
    # Get all services
    services = await db.services.find({}, {"_id": 0}).to_list(1000)
    print(f"Found {len(services)} services to update")
    
    updated_count = 0
    for service in services:
        service_id = service.get('id')
        service_name = service.get('service_name', '')
        
        # Determine category
        category = categorize_service(service_name)
        
        # Determine gender tag
        gender_tag = determine_gender(service_name)
        
        # Check if price should be "onwards"
        price_type = "onwards" if service_name.lower().find("onwards") != -1 else "fixed"
        
        # Update service
        update_data = {
            "category": category,
            "gender_tag": gender_tag,
            "price_type": price_type,
            "images": service.get('images', []),
            "is_favorite": service.get('is_favorite', False),
            "favorite_order": service.get('favorite_order', None)
        }
        
        await db.services.update_one(
            {"id": service_id},
            {"$set": update_data}
        )
        
        updated_count += 1
        print(f"Updated: {service_name} -> Category: {category}, Gender: {gender_tag}")
    
    print(f"\n✅ Migration complete! Updated {updated_count} services")
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_services())

"""
Initialize complete salon services list with all categories
Creates a comprehensive service catalog based on the provided menu
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
import uuid
from datetime import datetime, timezone

# Complete service catalog
SERVICES_CATALOG = [
    # CLEAN UP
    {"category": "Clean Up", "service_name": "Fruit Clean Up", "price": 700, "gender": "Unisex", "duration": 30},
    {"category": "Clean Up", "service_name": "Lotus Clean Up", "price": 800, "gender": "Unisex", "duration": 30},
    {"category": "Clean Up", "service_name": "VLCC Insta Glow Clean Up", "price": 1000, "gender": "Unisex", "duration": 30},
    {"category": "Clean Up", "service_name": "Wine Clean Up", "price": 1100, "gender": "Unisex", "duration": 30},
    {"category": "Clean Up", "service_name": "O3+ Clean Up", "price": 1500, "gender": "Unisex", "duration": 30},
    
    # FACIAL
    {"category": "Facial", "service_name": "Fruit Facial", "price": 1200, "gender": "Unisex", "duration": 45},
    {"category": "Facial", "service_name": "VLCC Insta Glow Facial", "price": 1800, "gender": "Unisex", "duration": 45},
    {"category": "Facial", "service_name": "Lotus Hydra Facial", "price": 2000, "gender": "Unisex", "duration": 45},
    {"category": "Facial", "service_name": "Aroma Gold Facial", "price": 1800, "gender": "Unisex", "duration": 45},
    {"category": "Facial", "service_name": "VLCC Pearl Facial", "price": 1500, "gender": "Unisex", "duration": 45},
    {"category": "Facial", "service_name": "Silver Facial", "price": 1500, "gender": "Unisex", "duration": 45},
    {"category": "Facial", "service_name": "Fruit Anti Tan Facial", "price": 1200, "gender": "Unisex", "duration": 45},
    {"category": "Facial", "service_name": "Gold Facial", "price": 1700, "gender": "Unisex", "duration": 45},
    {"category": "Facial", "service_name": "Diamond Facial", "price": 1800, "gender": "Unisex", "duration": 45},
    {"category": "Facial", "service_name": "Vita Lift Facial", "price": 2000, "gender": "Unisex", "duration": 45},
    {"category": "Facial", "service_name": "Tanclear Facial", "price": 1800, "gender": "Unisex", "duration": 45},
    {"category": "Facial", "service_name": "Glow N Sure Ozone", "price": 1600, "gender": "Unisex", "duration": 45},
    {"category": "Facial", "service_name": "Glow Vite Facial", "price": 1500, "gender": "Unisex", "duration": 45},
    {"category": "Facial", "service_name": "Gold Shine Lotus Facial", "price": 2000, "gender": "Unisex", "duration": 45},
    {"category": "Facial", "service_name": "Anti Acne Ozone Facial", "price": 1500, "gender": "Unisex", "duration": 45},
    {"category": "Facial", "service_name": "Kanpeki Facial", "price": 3000, "gender": "Unisex", "duration": 60},
    {"category": "Facial", "service_name": "Wine Facial", "price": 2000, "gender": "Unisex", "duration": 45},
    {"category": "Facial", "service_name": "O3+ Facial", "price": 2500, "gender": "Unisex", "duration": 60},
    
    # ADVANCE / HYDRA FACIAL
    {"category": "Advance Facial", "service_name": "Hydra Treatment", "price": 3000, "gender": "Unisex", "duration": 60},
    {"category": "Advance Facial", "service_name": "Hydra Anti Aging", "price": 2500, "gender": "Unisex", "duration": 60},
    {"category": "Advance Facial", "service_name": "Hydra Deep Cleaning", "price": 2000, "gender": "Unisex", "duration": 60},
    
    # MANICURE
    {"category": "Manicure", "service_name": "Normal Manicure", "price": 500, "gender": "Unisex", "duration": 45},
    {"category": "Manicure", "service_name": "Advance Manicure", "price": 700, "gender": "Unisex", "duration": 45},
    {"category": "Manicure", "service_name": "Anti Tan Manicure", "price": 800, "gender": "Unisex", "duration": 45},
    {"category": "Manicure", "service_name": "Lotus Manicure", "price": 900, "gender": "Unisex", "duration": 45},
    {"category": "Manicure", "service_name": "O3+ Manicure", "price": 1000, "gender": "Unisex", "duration": 45},
    
    # PEDICURE
    {"category": "Pedicure", "service_name": "Normal Pedicure", "price": 500, "gender": "Unisex", "duration": 45},
    {"category": "Pedicure", "service_name": "Advance Pedicure", "price": 800, "gender": "Unisex", "duration": 45},
    {"category": "Pedicure", "service_name": "Ozone Pedicure", "price": 1000, "gender": "Unisex", "duration": 45},
    {"category": "Pedicure", "service_name": "Lotus Pedicure", "price": 1200, "gender": "Unisex", "duration": 45},
    {"category": "Pedicure", "service_name": "Heel Peel Pedicure", "price": 1500, "gender": "Unisex", "duration": 60},
    {"category": "Pedicure", "service_name": "O3+ Pedicure", "price": 1500, "gender": "Unisex", "duration": 45},
    
    # HAIR CUT / GROOMING
    {"category": "Hair Cut", "service_name": "Women Hair Cut", "price": 350, "gender": "Women", "duration": 30},
    {"category": "Hair Cut", "service_name": "Baby Girl Hair Cut", "price": 200, "gender": "Women", "duration": 20},
    {"category": "Hair Cut", "service_name": "Hair Cut (Men)", "price": 150, "gender": "Men", "duration": 20},
    {"category": "Hair Cut", "service_name": "Shaving", "price": 80, "gender": "Men", "duration": 15},
    {"category": "Hair Cut", "service_name": "Hair Cut & Shaving", "price": 150, "gender": "Men", "duration": 30},
    
    # HAIR STYLING
    {"category": "Hair Styling", "service_name": "Blow Dry", "price": 200, "gender": "Unisex", "duration": 30, "price_type": "onwards"},
    {"category": "Hair Styling", "service_name": "Blow Dry & Wash", "price": 250, "gender": "Unisex", "duration": 40, "price_type": "onwards"},
    {"category": "Hair Styling", "service_name": "Pressing", "price": 500, "gender": "Unisex", "duration": 30, "price_type": "onwards"},
    {"category": "Hair Styling", "service_name": "Hair Curl", "price": 500, "gender": "Unisex", "duration": 45, "price_type": "onwards"},
    {"category": "Hair Styling", "service_name": "Hair Style", "price": 500, "gender": "Unisex", "duration": 45, "price_type": "onwards"},
    
    # MAKEUP
    {"category": "Makeup", "service_name": "Light Makeup", "price": 2000, "gender": "Women", "duration": 60, "price_type": "onwards"},
    {"category": "Makeup", "service_name": "Party Makeup", "price": 2500, "gender": "Women", "duration": 90, "price_type": "onwards"},
    {"category": "Makeup", "service_name": "Haldi Makeup", "price": 3000, "gender": "Women", "duration": 90, "price_type": "onwards"},
    {"category": "Makeup", "service_name": "Mehendi Makeup", "price": 5000, "gender": "Women", "duration": 120, "price_type": "onwards"},
    {"category": "Makeup", "service_name": "Engagement Makeup", "price": 5000, "gender": "Women", "duration": 120, "price_type": "onwards"},
    {"category": "Makeup", "service_name": "Engagement HD Makeup", "price": 8000, "gender": "Women", "duration": 150, "price_type": "onwards"},
    {"category": "Makeup", "service_name": "Bridal Makeup", "price": 10000, "gender": "Women", "duration": 180, "price_type": "onwards"},
    {"category": "Makeup", "service_name": "Bridal HD Makeup", "price": 15000, "gender": "Women", "duration": 180, "price_type": "onwards"},
    
    # HAIR SPA
    {"category": "Hair Spa", "service_name": "Normal Hair Spa", "price": 1000, "gender": "Unisex", "duration": 60, "price_type": "onwards"},
    {"category": "Hair Spa", "service_name": "Anti Hair Fall Spa", "price": 1500, "gender": "Unisex", "duration": 60, "price_type": "onwards"},
    {"category": "Hair Spa", "service_name": "Anti Dandruff Spa", "price": 1500, "gender": "Unisex", "duration": 60, "price_type": "onwards"},
    {"category": "Hair Spa", "service_name": "Absolut Repair Spa", "price": 1500, "gender": "Unisex", "duration": 60, "price_type": "onwards"},
    {"category": "Hair Spa", "service_name": "Keraplexid", "price": 2000, "gender": "Unisex", "duration": 90, "price_type": "onwards"},
    {"category": "Hair Spa", "service_name": "Rebonding", "price": 2500, "gender": "Unisex", "duration": 120, "price_type": "onwards"},
    {"category": "Hair Spa", "service_name": "Smoothing", "price": 3000, "gender": "Unisex", "duration": 120, "price_type": "onwards"},
    {"category": "Hair Spa", "service_name": "Fibreplex Treatment", "price": 4000, "gender": "Unisex", "duration": 120, "price_type": "onwards"},
    {"category": "Hair Spa", "service_name": "Botox", "price": 4000, "gender": "Unisex", "duration": 120, "price_type": "onwards"},
    {"category": "Hair Spa", "service_name": "Kerasmooth", "price": 5000, "gender": "Unisex", "duration": 120, "price_type": "onwards"},
    {"category": "Hair Spa", "service_name": "Nanoplastia", "price": 5000, "gender": "Unisex", "duration": 120, "price_type": "onwards"},
    
    # HAIR COLOUR
    {"category": "Hair Colour", "service_name": "Per Streaks", "price": 300, "gender": "Unisex", "duration": 30, "price_type": "onwards"},
    {"category": "Hair Colour", "service_name": "Loreal Root Touchup", "price": 800, "gender": "Unisex", "duration": 60, "price_type": "onwards"},
    {"category": "Hair Colour", "service_name": "Inoa Root Touchup", "price": 1000, "gender": "Unisex", "duration": 60, "price_type": "onwards"},
    {"category": "Hair Colour", "service_name": "Hair Box Touchup", "price": 1000, "gender": "Unisex", "duration": 60, "price_type": "onwards"},
    {"category": "Hair Colour", "service_name": "Schwarzkopf Touchup", "price": 1200, "gender": "Unisex", "duration": 60, "price_type": "onwards"},
    {"category": "Hair Colour", "service_name": "Essensity Touchup", "price": 1300, "gender": "Unisex", "duration": 60, "price_type": "onwards"},
    {"category": "Hair Colour", "service_name": "Loreal Global", "price": 2500, "gender": "Unisex", "duration": 90, "price_type": "onwards"},
    {"category": "Hair Colour", "service_name": "Inoa Global", "price": 3000, "gender": "Unisex", "duration": 90, "price_type": "onwards"},
    {"category": "Hair Colour", "service_name": "Schwarzkopf Global", "price": 3500, "gender": "Unisex", "duration": 90, "price_type": "onwards"},
    {"category": "Hair Colour", "service_name": "Essensity Global", "price": 3500, "gender": "Unisex", "duration": 90, "price_type": "onwards"},
    
    # WAXING (NORMAL)
    {"category": "Waxing (Normal)", "service_name": "Under Arms", "price": 100, "gender": "Unisex", "duration": 15},
    {"category": "Waxing (Normal)", "service_name": "Half Leg", "price": 250, "gender": "Unisex", "duration": 20},
    {"category": "Waxing (Normal)", "service_name": "Half Arms", "price": 250, "gender": "Unisex", "duration": 20},
    {"category": "Waxing (Normal)", "service_name": "Full Arms", "price": 300, "gender": "Unisex", "duration": 30},
    {"category": "Waxing (Normal)", "service_name": "Face", "price": 300, "gender": "Unisex", "duration": 20},
    {"category": "Waxing (Normal)", "service_name": "Full Leg", "price": 500, "gender": "Unisex", "duration": 40},
    {"category": "Waxing (Normal)", "service_name": "Full Body (Without V)", "price": 2500, "gender": "Unisex", "duration": 90},
    
    # WAXING (RICA)
    {"category": "Waxing (Rica)", "service_name": "Under Arms (Rica)", "price": 150, "gender": "Unisex", "duration": 15},
    {"category": "Waxing (Rica)", "service_name": "Face (Rica)", "price": 350, "gender": "Unisex", "duration": 20},
    {"category": "Waxing (Rica)", "service_name": "Half Leg (Rica)", "price": 400, "gender": "Unisex", "duration": 20},
    {"category": "Waxing (Rica)", "service_name": "Full Arms (Rica)", "price": 500, "gender": "Unisex", "duration": 30},
    {"category": "Waxing (Rica)", "service_name": "Full Leg (Rica)", "price": 700, "gender": "Unisex", "duration": 40},
    {"category": "Waxing (Rica)", "service_name": "Full Body (Rica Without V)", "price": 3000, "gender": "Unisex", "duration": 90},
    
    # MASSAGE
    {"category": "Massage", "service_name": "Head Massage", "price": 350, "gender": "Unisex", "duration": 30, "price_type": "onwards"},
    {"category": "Massage", "service_name": "Foot Massage", "price": 350, "gender": "Unisex", "duration": 30, "price_type": "onwards"},
    {"category": "Massage", "service_name": "Back Massage", "price": 400, "gender": "Unisex", "duration": 30, "price_type": "onwards"},
    
    # BODY CARE
    {"category": "Body Care", "service_name": "Body Polishing", "price": 3000, "gender": "Unisex", "duration": 90, "price_type": "onwards"},
    {"category": "Body Care", "service_name": "Full Body Bleach", "price": 3000, "gender": "Unisex", "duration": 60, "price_type": "onwards"},
    {"category": "Body Care", "service_name": "Full Body D-Tan", "price": 3000, "gender": "Unisex", "duration": 60, "price_type": "onwards"},
    
    # BLEACH
    {"category": "Bleach", "service_name": "Fruit Bleach", "price": 300, "gender": "Unisex", "duration": 30},
    {"category": "Bleach", "service_name": "Gold Bleach", "price": 300, "gender": "Unisex", "duration": 30},
    {"category": "Bleach", "service_name": "D-Tan Bleach", "price": 300, "gender": "Unisex", "duration": 30},
    {"category": "Bleach", "service_name": "Lacto Bleach", "price": 500, "gender": "Unisex", "duration": 30},
    
    # FACE TREATMENTS
    {"category": "Face Treatments", "service_name": "Eye Treatment (5 sittings)", "price": 300, "gender": "Unisex", "duration": 30},
    {"category": "Face Treatments", "service_name": "Pimples Treatment (5 sittings)", "price": 1200, "gender": "Unisex", "duration": 45},
    {"category": "Face Treatments", "service_name": "Pigmentation Treatment (5 sittings)", "price": 1200, "gender": "Unisex", "duration": 45},
    {"category": "Face Treatments", "service_name": "Skin Lightening (5 sittings)", "price": 1500, "gender": "Unisex", "duration": 45},
    
    # SHAMPOO
    {"category": "Shampoo", "service_name": "Shampoo", "price": 50, "gender": "Unisex", "duration": 15},
    {"category": "Shampoo", "service_name": "Advanced Shampoo", "price": 100, "gender": "Unisex", "duration": 20},
    {"category": "Shampoo", "service_name": "Deep Conditioning", "price": 150, "gender": "Unisex", "duration": 25},
    
    # THREADING / BASIC
    {"category": "Threading", "service_name": "Threading", "price": 100, "gender": "Unisex", "duration": 15},
    {"category": "Threading", "service_name": "Upper Lip / Forehead", "price": 150, "gender": "Unisex", "duration": 10},
]

PACKAGES_CATALOG = [
    {
        "package_name": "Bridal Package 1",
        "description": "Diamond Facial, Diamond Bleach, Hair Spa, Threading, Full Body Waxing, Manicure, Pedicure",
        "total_price": 6999,
        "gender_tag": "Women"
    },
    {
        "package_name": "Bridal Package 2",
        "description": "Facial Aroma, O3+ Facial, Loreal Hair Spa, Full Body Waxing, Face Bleach D-Tan, Manicure/Pedicure Ozone",
        "total_price": 4999,
        "gender_tag": "Women"
    },
    {
        "package_name": "Bridal Package 3",
        "description": "Kanpeki Facial, O3+ Facial, Full Body Rica Waxing, Full Body Bleach, Full Body Polishing, Hair Spa, Manicure/Pedicure, Haircut, Threading",
        "total_price": 14999,
        "gender_tag": "Women"
    },
    {
        "package_name": "Groom Package 1",
        "description": "Hair Cut, Beard, D-Tan (3), Hair Spa, Hair Colour, Gold Facial, Aroma Facial",
        "total_price": 9999,
        "gender_tag": "Men"
    },
    {
        "package_name": "Groom Package 2",
        "description": "Lotus Facial, Wine Facial, Lotus Cleanup, D-Tan, Hair Spa, Colour Loreal Inoa, Hair Cut, Beard (2)",
        "total_price": 4999,
        "gender_tag": "Men"
    },
    {
        "package_name": "Groom Package 3",
        "description": "Cleanup, Gold Facial (2), Kanpeki Facial, Hydera Facial, D-Tan (3), Hair Cut, Threading, Beard (2), Hair Spa, Hair Colour, Groom Makeup",
        "total_price": 9999,
        "gender_tag": "Men"
    }
]

async def initialize_complete_services():
    """Initialize complete service catalog"""
    # Load environment
    ROOT_DIR = Path(__file__).parent
    load_dotenv(ROOT_DIR / '.env')
    
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'test_database')]
    
    print("🚀 Initializing complete salon services catalog...")
    
    # Clear existing services (optional - comment out if you want to keep existing)
    # await db.services.delete_many({})
    # print("Cleared existing services")
    
    # Insert all services
    services_created = 0
    for service_data in SERVICES_CATALOG:
        # Check if service already exists
        existing = await db.services.find_one({"service_name": service_data["service_name"]})
        
        if not existing:
            service_doc = {
                "id": str(uuid.uuid4()),
                "service_name": service_data["service_name"],
                "description": f"{service_data['service_name']} service",
                "category": service_data["category"],
                "gender_tag": service_data["gender"],
                "default_duration": service_data["duration"],
                "base_price": service_data["price"],
                "price_type": service_data.get("price_type", "fixed"),
                "images": [],
                "is_favorite": False,
                "favorite_order": None,
                "is_active": True,
                "is_enabled": True,  # NEW: Salon can enable/disable
                "available_at_home": False,  # NEW: Can be delivered at home
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.services.insert_one(service_doc)
            services_created += 1
            print(f"✓ Added: {service_data['service_name']} ({service_data['category']})")
        else:
            # Update existing service with new fields
            await db.services.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "category": service_data["category"],
                    "gender_tag": service_data["gender"],
                    "default_duration": service_data["duration"],
                    "base_price": service_data["price"],
                    "price_type": service_data.get("price_type", "fixed"),
                    "is_enabled": existing.get("is_enabled", True),
                    "available_at_home": existing.get("available_at_home", False)
                }}
            )
            print(f"⟳ Updated: {service_data['service_name']}")
    
    print(f"\n✅ Created {services_created} new services")
    
    # Insert packages
    print("\n🎁 Initializing packages...")
    packages_created = 0
    for pkg_data in PACKAGES_CATALOG:
        existing_pkg = await db.packages.find_one({"package_name": pkg_data["package_name"]})
        
        if not existing_pkg:
            package_doc = {
                "id": str(uuid.uuid4()),
                "package_name": pkg_data["package_name"],
                "description": pkg_data["description"],
                "service_ids": [],  # Will be populated later
                "total_price": pkg_data["total_price"],
                "image_url": None,
                "gender_tag": pkg_data["gender_tag"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.packages.insert_one(package_doc)
            packages_created += 1
            print(f"✓ Added package: {pkg_data['package_name']}")
    
    print(f"\n✅ Created {packages_created} packages")
    
    # Count services by category
    print("\n📊 Services by category:")
    categories = {}
    all_services = await db.services.find({}, {"_id": 0, "category": 1}).to_list(1000)
    for svc in all_services:
        cat = svc.get("category", "General")
        categories[cat] = categories.get(cat, 0) + 1
    
    for cat, count in sorted(categories.items()):
        print(f"  {cat}: {count} services")
    
    total_services = await db.services.count_documents({})
    print(f"\n🎉 Total services in database: {total_services}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(initialize_complete_services())

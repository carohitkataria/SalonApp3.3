"""
Predefined Services and Packages for Salon
These will be auto-initialized when a salon first accesses the dashboard
"""

PREDEFINED_SERVICES = [
    # CLEAN UP
    {"service_name": "Fruit Clean Up", "category": "Clean Up", "base_price": 700, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "Lotus Clean Up", "category": "Clean Up", "base_price": 800, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "VLCC Insta Glow Clean Up", "category": "Clean Up", "base_price": 1000, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "Wine Clean Up", "category": "Clean Up", "base_price": 1100, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "O3+ Clean Up", "category": "Clean Up", "base_price": 1500, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    
    # FACIAL
    {"service_name": "Fruit Facial", "category": "Facial", "base_price": 1200, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "VLCC Insta Glow Facial", "category": "Facial", "base_price": 1800, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Lotus Hydra Facial", "category": "Facial", "base_price": 2000, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Aroma Gold Facial", "category": "Facial", "base_price": 1800, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "VLCC Pearl Facial", "category": "Facial", "base_price": 1500, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Silver Facial", "category": "Facial", "base_price": 1500, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Fruit Anti Tan Facial", "category": "Facial", "base_price": 1200, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Gold Facial", "category": "Facial", "base_price": 1700, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Diamond Facial", "category": "Facial", "base_price": 1800, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Vita Lift Facial", "category": "Facial", "base_price": 2000, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Tanclear Facial", "category": "Facial", "base_price": 1800, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Glow N Sure Ozone", "category": "Facial", "base_price": 1600, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Glow Vite Facial", "category": "Facial", "base_price": 1500, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Gold Shine Lotus Facial", "category": "Facial", "base_price": 2000, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Anti Acne Ozone Facial", "category": "Facial", "base_price": 1500, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Kanpeki Facial", "category": "Facial", "base_price": 3000, "price_type": "fixed", "default_duration": 60, "gender_tag": "Unisex"},
    {"service_name": "Wine Facial", "category": "Facial", "base_price": 2000, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "O3+ Facial", "category": "Facial", "base_price": 2500, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    
    # ADVANCE / HYDRA FACIAL
    {"service_name": "Hydra Treatment", "category": "Advance/Hydra Facial", "base_price": 3000, "price_type": "fixed", "default_duration": 60, "gender_tag": "Unisex"},
    {"service_name": "Hydra Anti Aging", "category": "Advance/Hydra Facial", "base_price": 2500, "price_type": "fixed", "default_duration": 60, "gender_tag": "Unisex"},
    {"service_name": "Hydra Deep Cleaning", "category": "Advance/Hydra Facial", "base_price": 2000, "price_type": "fixed", "default_duration": 60, "gender_tag": "Unisex"},
    
    # MANICURE
    {"service_name": "Normal Manicure", "category": "Manicure", "base_price": 500, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "Advance Manicure", "category": "Manicure", "base_price": 700, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "Anti Tan Manicure", "category": "Manicure", "base_price": 800, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "Lotus Manicure", "category": "Manicure", "base_price": 900, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "O3+ Manicure", "category": "Manicure", "base_price": 1000, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    
    # PEDICURE
    {"service_name": "Normal Pedicure", "category": "Pedicure", "base_price": 500, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Advance Pedicure", "category": "Pedicure", "base_price": 800, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Ozone Pedicure", "category": "Pedicure", "base_price": 1000, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Lotus Pedicure", "category": "Pedicure", "base_price": 1200, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Heel Peel", "category": "Pedicure", "base_price": 1500, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "O3+ Pedicure", "category": "Pedicure", "base_price": 1500, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    
    # HAIR CUT / GROOMING
    {"service_name": "Women Hair Cut", "category": "Hair Cut/Grooming", "base_price": 350, "price_type": "fixed", "default_duration": 30, "gender_tag": "Women"},
    {"service_name": "Baby Girl Hair Cut", "category": "Hair Cut/Grooming", "base_price": 200, "price_type": "fixed", "default_duration": 20, "gender_tag": "Women"},
    {"service_name": "Hair Cut (Men)", "category": "Hair Cut/Grooming", "base_price": 150, "price_type": "fixed", "default_duration": 20, "gender_tag": "Men"},
    {"service_name": "Shaving", "category": "Hair Cut/Grooming", "base_price": 80, "price_type": "fixed", "default_duration": 15, "gender_tag": "Men"},
    {"service_name": "Hair Cut & Shaving", "category": "Hair Cut/Grooming", "base_price": 150, "price_type": "fixed", "default_duration": 30, "gender_tag": "Men"},
    
    # HAIR STYLING
    {"service_name": "Blow Dry", "category": "Hair Styling", "base_price": 200, "price_type": "onwards", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "Blow Dry & Wash", "category": "Hair Styling", "base_price": 250, "price_type": "onwards", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "Pressing", "category": "Hair Styling", "base_price": 500, "price_type": "onwards", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Hair Curl", "category": "Hair Styling", "base_price": 500, "price_type": "onwards", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Hair Style", "category": "Hair Styling", "base_price": 500, "price_type": "onwards", "default_duration": 45, "gender_tag": "Unisex"},
    
    # MAKEUP
    {"service_name": "Light Makeup", "category": "Makeup", "base_price": 2000, "price_type": "onwards", "default_duration": 60, "gender_tag": "Women"},
    {"service_name": "Party Makeup", "category": "Makeup", "base_price": 2500, "price_type": "onwards", "default_duration": 60, "gender_tag": "Women"},
    {"service_name": "Haldi Makeup", "category": "Makeup", "base_price": 3000, "price_type": "onwards", "default_duration": 60, "gender_tag": "Women"},
    {"service_name": "Mehendi Makeup", "category": "Makeup", "base_price": 5000, "price_type": "onwards", "default_duration": 90, "gender_tag": "Women"},
    {"service_name": "Engagement Makeup", "category": "Makeup", "base_price": 5000, "price_type": "onwards", "default_duration": 90, "gender_tag": "Women"},
    {"service_name": "Engagement HD Makeup", "category": "Makeup", "base_price": 8000, "price_type": "onwards", "default_duration": 90, "gender_tag": "Women"},
    {"service_name": "Bridal Makeup", "category": "Makeup", "base_price": 10000, "price_type": "onwards", "default_duration": 120, "gender_tag": "Women"},
    {"service_name": "Bridal HD Makeup", "category": "Makeup", "base_price": 15000, "price_type": "onwards", "default_duration": 120, "gender_tag": "Women"},
    
    # HAIR SPA
    {"service_name": "Normal Hair Spa", "category": "Hair Spa", "base_price": 1000, "price_type": "onwards", "default_duration": 60, "gender_tag": "Unisex"},
    {"service_name": "Anti Hair Fall Spa", "category": "Hair Spa", "base_price": 1500, "price_type": "onwards", "default_duration": 60, "gender_tag": "Unisex"},
    {"service_name": "Anti Dandruff Spa", "category": "Hair Spa", "base_price": 1500, "price_type": "onwards", "default_duration": 60, "gender_tag": "Unisex"},
    {"service_name": "Absolut Repair Spa", "category": "Hair Spa", "base_price": 1500, "price_type": "onwards", "default_duration": 60, "gender_tag": "Unisex"},
    {"service_name": "Keraplexid", "category": "Hair Spa", "base_price": 2000, "price_type": "onwards", "default_duration": 60, "gender_tag": "Unisex"},
    {"service_name": "Rebonding", "category": "Hair Spa", "base_price": 2500, "price_type": "onwards", "default_duration": 120, "gender_tag": "Unisex"},
    {"service_name": "Smoothing", "category": "Hair Spa", "base_price": 3000, "price_type": "onwards", "default_duration": 120, "gender_tag": "Unisex"},
    {"service_name": "Fibreplex Treatment", "category": "Hair Spa", "base_price": 4000, "price_type": "onwards", "default_duration": 90, "gender_tag": "Unisex"},
    {"service_name": "Botox", "category": "Hair Spa", "base_price": 4000, "price_type": "onwards", "default_duration": 90, "gender_tag": "Unisex"},
    {"service_name": "Kerasmooth", "category": "Hair Spa", "base_price": 5000, "price_type": "onwards", "default_duration": 120, "gender_tag": "Unisex"},
    {"service_name": "Nanoplastia", "category": "Hair Spa", "base_price": 5000, "price_type": "onwards", "default_duration": 120, "gender_tag": "Unisex"},
    
    # HAIR COLOUR
    {"service_name": "Per Streaks", "category": "Hair Colour", "base_price": 300, "price_type": "onwards", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Loreal Root Touchup", "category": "Hair Colour", "base_price": 800, "price_type": "onwards", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Inoa Root Touchup", "category": "Hair Colour", "base_price": 1000, "price_type": "onwards", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Hair Box Touchup", "category": "Hair Colour", "base_price": 1000, "price_type": "onwards", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Schwarzkopf Touchup", "category": "Hair Colour", "base_price": 1200, "price_type": "onwards", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Essensity Touchup", "category": "Hair Colour", "base_price": 1300, "price_type": "onwards", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Loreal Global", "category": "Hair Colour", "base_price": 2500, "price_type": "onwards", "default_duration": 90, "gender_tag": "Unisex"},
    {"service_name": "Inoa Global", "category": "Hair Colour", "base_price": 3000, "price_type": "onwards", "default_duration": 90, "gender_tag": "Unisex"},
    {"service_name": "Schwarzkopf Global", "category": "Hair Colour", "base_price": 3500, "price_type": "onwards", "default_duration": 90, "gender_tag": "Unisex"},
    {"service_name": "Essensity Global", "category": "Hair Colour", "base_price": 3500, "price_type": "onwards", "default_duration": 90, "gender_tag": "Unisex"},
    
    # WAXING (NORMAL)
    {"service_name": "Under Arms Waxing", "category": "Waxing (Normal)", "base_price": 100, "price_type": "fixed", "default_duration": 15, "gender_tag": "Unisex"},
    {"service_name": "Half Leg Waxing", "category": "Waxing (Normal)", "base_price": 250, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "Half Arms Waxing", "category": "Waxing (Normal)", "base_price": 250, "price_type": "fixed", "default_duration": 20, "gender_tag": "Unisex"},
    {"service_name": "Full Arms Waxing", "category": "Waxing (Normal)", "base_price": 300, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "Face Waxing", "category": "Waxing (Normal)", "base_price": 300, "price_type": "fixed", "default_duration": 20, "gender_tag": "Unisex"},
    {"service_name": "Full Leg Waxing", "category": "Waxing (Normal)", "base_price": 500, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Full Body Waxing (Without V)", "category": "Waxing (Normal)", "base_price": 2500, "price_type": "fixed", "default_duration": 90, "gender_tag": "Women"},
    
    # WAXING (RICA)
    {"service_name": "Under Arms Rica", "category": "Waxing (Rica)", "base_price": 150, "price_type": "fixed", "default_duration": 15, "gender_tag": "Unisex"},
    {"service_name": "Face Rica", "category": "Waxing (Rica)", "base_price": 350, "price_type": "fixed", "default_duration": 20, "gender_tag": "Unisex"},
    {"service_name": "Half Leg Rica", "category": "Waxing (Rica)", "base_price": 400, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "Full Arms Rica", "category": "Waxing (Rica)", "base_price": 500, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "Full Leg Rica", "category": "Waxing (Rica)", "base_price": 700, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex"},
    {"service_name": "Full Body Rica (Without V)", "category": "Waxing (Rica)", "base_price": 3000, "price_type": "fixed", "default_duration": 90, "gender_tag": "Women"},
    
    # MASSAGE
    {"service_name": "Head Massage", "category": "Massage", "base_price": 350, "price_type": "onwards", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "Foot Massage", "category": "Massage", "base_price": 350, "price_type": "onwards", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "Back Massage", "category": "Massage", "base_price": 400, "price_type": "onwards", "default_duration": 30, "gender_tag": "Unisex"},
    
    # BODY CARE
    {"service_name": "Body Polishing", "category": "Body Care", "base_price": 3000, "price_type": "onwards", "default_duration": 90, "gender_tag": "Unisex"},
    {"service_name": "Full Body Bleach", "category": "Body Care", "base_price": 3000, "price_type": "onwards", "default_duration": 60, "gender_tag": "Unisex"},
    {"service_name": "Full Body D-Tan", "category": "Body Care", "base_price": 3000, "price_type": "onwards", "default_duration": 60, "gender_tag": "Unisex"},
    
    # BLEACH
    {"service_name": "Fruit Bleach", "category": "Bleach", "base_price": 300, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "Gold Bleach", "category": "Bleach", "base_price": 300, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "D-Tan Bleach", "category": "Bleach", "base_price": 300, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    {"service_name": "Lacto Bleach", "category": "Bleach", "base_price": 500, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    
    # FACE TREATMENTS
    {"service_name": "Eye Treatment", "category": "Face Treatments", "base_price": 300, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex", "description": "5 sittings"},
    {"service_name": "Pimples Treatment", "category": "Face Treatments", "base_price": 1200, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex", "description": "5 sittings"},
    {"service_name": "Pigmentation Treatment", "category": "Face Treatments", "base_price": 1200, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex", "description": "5 sittings"},
    {"service_name": "Skin Lightening", "category": "Face Treatments", "base_price": 1500, "price_type": "fixed", "default_duration": 45, "gender_tag": "Unisex", "description": "5 sittings"},
    
    # SHAMPOO
    {"service_name": "Shampoo", "category": "Shampoo", "base_price": 50, "price_type": "fixed", "default_duration": 15, "gender_tag": "Unisex"},
    {"service_name": "Advanced Shampoo", "category": "Shampoo", "base_price": 100, "price_type": "fixed", "default_duration": 20, "gender_tag": "Unisex"},
    {"service_name": "Deep Conditioning", "category": "Shampoo", "base_price": 150, "price_type": "fixed", "default_duration": 30, "gender_tag": "Unisex"},
    
    # THREADING / BASIC
    {"service_name": "Threading", "category": "Threading/Basic", "base_price": 100, "price_type": "fixed", "default_duration": 15, "gender_tag": "Unisex"},
    {"service_name": "Upper Lip Threading", "category": "Threading/Basic", "base_price": 150, "price_type": "fixed", "default_duration": 10, "gender_tag": "Unisex"},
    {"service_name": "Forehead Threading", "category": "Threading/Basic", "base_price": 150, "price_type": "fixed", "default_duration": 10, "gender_tag": "Unisex"},
]

PREDEFINED_PACKAGES = [
    {
        "package_name": "Bridal Package 1",
        "description": "Complete bridal package",
        "total_price": 6999,
        "gender_tag": "Women"
    },
    {
        "package_name": "Bridal Package 2",
        "description": "Essential bridal package",
        "total_price": 4999,
        "gender_tag": "Women"
    },
    {
        "package_name": "Bridal Package 3",
        "description": "Premium bridal package",
        "total_price": 14999,
        "gender_tag": "Women"
    },
    {
        "package_name": "Groom Package 1",
        "description": "Complete groom package",
        "total_price": 9999,
        "gender_tag": "Men"
    },
    {
        "package_name": "Groom Package 2",
        "description": "Essential groom package",
        "total_price": 4999,
        "gender_tag": "Men"
    },
    {
        "package_name": "Groom Package 3",
        "description": "Premium groom package",
        "total_price": 9999,
        "gender_tag": "Men"
    },
]

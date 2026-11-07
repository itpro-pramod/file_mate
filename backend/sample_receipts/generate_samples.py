import os
from PIL import Image, ImageDraw, ImageFont

receipts_dir = os.path.dirname(os.path.abspath(__file__))

def create_receipt_image(filename, lines, title="EXPENSE RECEIPT"):
    width, height = 650, 420
    img = Image.new("RGB", (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    # Border
    draw.rectangle([(10, 10), (width - 10, height - 10)], outline=(200, 210, 220), width=2)
    # Header bar
    draw.rectangle([(10, 10), (width - 10, 60)], fill=(37, 99, 235))
    draw.text((25, 22), title, fill=(255, 255, 255))
    
    y = 80
    for line in lines:
        if line.startswith("---"):
            draw.line([(30, y + 10), (width - 30, y + 10)], fill=(220, 225, 230), width=1)
            y += 25
        elif line.startswith("TOTAL:"):
            draw.text((30, y), line, fill=(37, 99, 235))
            y += 35
        else:
            draw.text((30, y), line, fill=(30, 41, 59))
            y += 28
            
    filepath = os.path.join(receipts_dir, filename)
    img.save(filepath)
    print(f"Generated: {filepath}")

# 1. Uber Receipt (Local Travel)
create_receipt_image(
    "sample_uber_receipt.png",
    [
        "Merchant: Uber India Systems Pvt Ltd",
        "Trip: Terminal 2 Airport to Brightpath Office",
        "Date: 28 Oct 2026",
        "Vehicle: Uber Premier",
        "Fare: 1,250.00 INR",
        "Payment: Corporate Card ending in 4102",
        "---",
        "TOTAL: 1,250.00 INR (Local Travel)"
    ],
    title="UBER TRIP RECEIPT - TAX INVOICE"
)

# 2. Hotel Lakeview (Hotel Lodging)
create_receipt_image(
    "sample_hotel_lakeview.png",
    [
        "Merchant: Hotel Lakeview Executive Suites",
        "Guest: Priya Nair (Brightpath Consulting)",
        "Check-In: 28 Oct 2026  |  Check-Out: 29 Oct 2026",
        "Itemised Tariff: Room Deluxe ₹5,800.00",
        "Taxes (GST 12%): ₹600.00",
        "---",
        "TOTAL: 6,400.00 INR (Hotel Lodging)"
    ],
    title="HOTEL LAKEVIEW - FOLIO INVOICE"
)

# 3. Cafe Mocha (Meals)
create_receipt_image(
    "sample_cafe_mocha.png",
    [
        "Merchant: Cafe Mocha Business Bistro",
        "Date: 29 Oct 2026",
        "Items: 2x Cappuccino, 1x Executive Lunch Combo",
        "Alcohol: 0.00 INR (Strictly Non-Alcoholic)",
        "Taxes: 40.00 INR",
        "---",
        "TOTAL: 760.00 INR (Meals)"
    ],
    title="CAFE MOCHA - DINING RECEIPT"
)

# 4. Voxora AI Workshop (Project VoxoraAI)
create_receipt_image(
    "sample_voxora_workshop.png",
    [
        "Merchant: Voxora AI Labs Cloud Compute",
        "Client: Enterprise Generative AI Engagements",
        "Date: 31 Oct 2026",
        "Service: Cloud Token Compute & Workshop Materials",
        "---",
        "TOTAL: 4,250.00 INR (Project VOXORAAI)"
    ],
    title="VOXORA AI LABS - SERVICES INVOICE"
)

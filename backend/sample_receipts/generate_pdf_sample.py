from PIL import Image
import os

receipts_dir = os.path.dirname(os.path.abspath(__file__))
# Convert sample image to PDF
img = Image.open(os.path.join(receipts_dir, "sample_uber_receipt.png")).convert("RGB")
pdf_path = os.path.join(receipts_dir, "sample_uber_receipt.pdf")
img.save(pdf_path, "PDF", resolution=100.0)
print(f"Generated sample PDF: {pdf_path}")

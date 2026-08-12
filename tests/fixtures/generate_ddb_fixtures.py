from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

ROOT = Path(__file__).resolve().parent
FOOTER = "TM & © 2018 Wizards of the Coast LLC. ©2018 D&D Beyond | All Rights Reserved. Permission is granted to photo copy this document for personal use."


def label(pdf, value, x, y, size=10):
    pdf.setFont("Helvetica-Bold", size)
    pdf.drawString(x, y, value)


def field(pdf, name, value, x, y, width=180):
    pdf.acroForm.textfield(
        name=name,
        value=value,
        x=x,
        y=y,
        width=width,
        height=18,
        borderWidth=1,
        fontName="Helvetica",
        fontSize=9,
    )


def footer(pdf):
    pdf.setFont("Helvetica", 5.5)
    pdf.drawString(24, 18, FOOTER)


def recognized():
    output = ROOT / "synthetic-ddb-export.pdf"
    pdf = canvas.Canvas(str(output), pagesize=letter, pageCompression=1)
    label(pdf, "CHARACTER NAME", 36, 730)
    label(pdf, "CLASS & LEVEL PLAYER NAME", 280, 730)
    field(pdf, "CharacterName", "Synthetic Ranger", 36, 700, 220)
    footer(pdf)
    pdf.showPage()

    label(pdf, "CHARACTER NAME", 36, 730)
    label(pdf, "EQUIPMENT", 36, 660, 14)
    label(pdf, "WEIGHT CARRIED", 36, 625)
    label(pdf, "ENCUMBERED", 190, 625)
    label(pdf, "PUSH/DRAG/LIFT", 330, 625)
    label(pdf, "NAME QTY WEIGHT", 36, 590)
    field(pdf, "WeightCarried", "12.5", 36, 600, 90)
    field(pdf, "CarryingCapacity", "150", 330, 600, 90)
    field(pdf, "EquipmentName1", "Longsword", 36, 550, 180)
    field(pdf, "EquipmentQty1", "2", 225, 550, 45)
    field(pdf, "EquipmentWeight1", "3", 280, 550, 55)
    field(pdf, "EquipmentName2", "Trail Rations", 36, 520, 180)
    field(pdf, "EquipmentQty2", "5", 225, 520, 45)
    field(pdf, "EquipmentWeight2", "2", 280, 520, 55)
    footer(pdf)
    pdf.showPage()

    label(pdf, "CHARACTER NAME", 36, 730)
    label(pdf, "ADDITIONAL EQUIPMENT", 36, 660, 14)
    label(pdf, "NAME QTY WEIGHT", 36, 620)
    footer(pdf)
    pdf.save()


def generic():
    output = ROOT / "synthetic-generic-sheet.pdf"
    pdf = canvas.Canvas(str(output), pagesize=letter)
    for page in range(3):
        label(pdf, "GENERIC CHARACTER INVENTORY", 36, 730, 14)
        pdf.setFont("Helvetica", 10)
        pdf.drawString(36, 690, f"Page {page + 1}: not a D&D Beyond export")
        pdf.showPage()
    pdf.save()


if __name__ == "__main__":
    recognized()
    generic()

import io
import json
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ASSETS = Path(__file__).resolve().parent.parent / "assets"
WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]


def loadfont(fontsize):
    return ImageFont.truetype(str(ASSETS / "fonts" / "Pretendard-Bold.ttf"), fontsize)


def rest(lst, date, is_empty):
    W = 1024
    H = 1024

    date_font = loadfont(36)
    date_font_color = "rgb(196, 196, 196)"

    image = Image.open(ASSETS / "images" / "rest_background.png")
    draw = ImageDraw.Draw(image)

    parsed_day = date.split("-")
    text = f"{parsed_day[0]}년 {parsed_day[1]}월"
    draw.text((W - 290, 75), text, font=date_font, fill=date_font_color, align="right")

    rest_font = loadfont(56)
    rest_font_color = "rgb(234, 92,81)"

    text_l = 70
    lst = reversed(lst)

    if is_empty:
        draw.text((75, H - 75 - text_l), "휴일이 없어요 ㅠㅠ", font=rest_font, fill=rest_font_color)
    else:
        for l in lst:
            weekday = WEEKDAYS[datetime.strptime(l["date"], "%Y-%m-%d").weekday()]
            dayNumber = int(l["date"].split("-")[2])
            content = l["content"]
            draw.text(
                (75, H - 75 - text_l),
                f"{dayNumber}일 ({weekday}) - {content}",
                font=rest_font,
                fill=rest_font_color,
            )
            text_l += 85

    return image.convert("RGB")


def main():
    payload = json.load(sys.stdin)
    date = payload["date"]
    items = payload.get("items") or []

    image = rest(items, date, len(items) == 0)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=95)
    sys.stdout.buffer.write(buffer.getvalue())


if __name__ == "__main__":
    main()

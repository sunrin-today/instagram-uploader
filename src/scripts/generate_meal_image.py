import json
import os
import random
import sys
import time
from datetime import datetime

import requests
from PIL import Image, ImageDraw, ImageFont


def loadfont(fontsize):
    ttf = './src/assets/fonts/Pretendard-Bold.ttf'
    return ImageFont.truetype(font=ttf, size=fontsize)

weekdays = ['월', '화', '수', '목', '금']

def school_meal(lst, date, weekday):
    W = 1024
    H = 1024

    lst = list(reversed(lst))

    date_font = loadfont(36)
    date_font_color = 'rgb(196, 196, 196)'

    image = Image.open('./src/assets/images/food_background.png')
    draw = ImageDraw.Draw(image)

    parsed_day = date.split('-')
    text = f'{parsed_day[0]}년 {parsed_day[1]}월 {parsed_day[2]}일 {weekdays[weekday]}요일'
    draw.text((W - 392 - 90, 75), text, font=date_font, fill=date_font_color, align='right')

    meal_font = loadfont(70)
    meal_font_color = 'rgb(71, 122, 255)'

    text_l = 70
    
    if len(lst) == 0:
        draw.text((75, H - 75 - text_l), '급식이 없어요 ㅠㅠ', font=meal_font, fill=meal_font_color)
    else:
        for l in lst:
            draw.text((75, H - 75 - text_l), l, font=meal_font, fill=meal_font_color)
            text_l += 85

    image.convert('RGB').save('./build/meal.jpeg', format='JPEG', quality=95)


def get_meal_json():
    today = datetime.today()
    date = today.strftime('%Y-%m-%d')
    response = requests.get(
        f"{os.environ['API_BASE_URL']}/meal/today",
        headers={"X-API-Key": os.environ["API_KEY"]},
    )
    data = response.json()['data']['meals']
    todayData = [d['meal'] for d in data]
    school_meal(todayData, date, today.weekday())

def main():
    if not os.path.exists('./build/'):
        os.makedirs('./build/')

    get_meal_json()

main()

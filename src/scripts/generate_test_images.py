from datetime import datetime
from pathlib import Path

from generate_meal_image import school_meal
from generate_rest_image import rest

OUT_DIR = Path(__file__).resolve().parents[2] / "test_images"
DATE = "2026-09-04"
WEEKDAY = datetime.strptime(DATE, "%Y-%m-%d").weekday()


def save(name, image):
    path = OUT_DIR / f"{name}.jpeg"
    image.save(path, format="JPEG", quality=95)
    print(path.name)


def rest_items(pairs):
    return [{"date": date, "content": content} for date, content in pairs]


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*"):
        if old.is_file():
            old.unlink()

    save(
        "01_meal_typical",
        school_meal(
            ["쌀밥", "된장찌개", "제육볶음", "시금치나물", "배추김치", "우유"],
            DATE,
            WEEKDAY,
        ),
    )
    save("02_meal_empty", school_meal([], DATE, WEEKDAY))
    save(
        "03_meal_long_name",
        school_meal(
            [
                "쌀밥",
                "오징어볶음과 야채볶음 모둠",
                "전국연합학력평가도시락",
                "배추김치",
            ],
            DATE,
            WEEKDAY,
        ),
    )
    save(
        "04_meal_many",
        school_meal(
            [
                "쌀밥",
                "현미밥",
                "미역국",
                "된장찌개",
                "제육볶음",
                "고등어구이",
                "시금치나물",
                "콩나물무침",
                "계란말이",
                "배추김치",
                "깍두기",
                "요구르트",
            ],
            DATE,
            WEEKDAY,
        ),
    )
    save("05_meal_holiday", school_meal(["개교기념일"], DATE, WEEKDAY))

    save(
        "06_rest_typical",
        rest(
            rest_items(
                [
                    ("2026-09-07", "개교기념일"),
                    ("2026-09-16", "추석연휴 시작"),
                    ("2026-09-17", "추석"),
                    ("2026-09-18", "추석연휴"),
                ]
            ),
            DATE,
            False,
        ),
    )
    save("07_rest_empty", rest([], DATE, True))
    save(
        "08_rest_long_name",
        rest(
            rest_items(
                [
                    ("2026-09-07", "개교기념일"),
                    ("2026-09-15", "전국연합학력평가 및 창의적체험활동 행사"),
                    ("2026-09-16", "추석"),
                ]
            ),
            DATE,
            False,
        ),
    )
    save(
        "09_rest_many",
        rest(
            rest_items(
                [
                    ("2026-09-01", "개학식"),
                    ("2026-09-02", "적응활동"),
                    ("2026-09-03", "자율휴업"),
                    ("2026-09-07", "개교기념일"),
                    ("2026-09-08", "재량휴업"),
                    ("2026-09-09", "체육대회"),
                    ("2026-09-10", "현장체험학습"),
                    ("2026-09-15", "학력평가"),
                    ("2026-09-16", "추석연휴"),
                    ("2026-09-17", "추석"),
                    ("2026-09-18", "추석연휴"),
                    ("2026-09-21", "재량휴업"),
                    ("2026-09-22", "교직원연수"),
                    ("2026-09-28", "중간고사"),
                    ("2026-09-29", "중간고사"),
                    ("2026-09-30", "중간고사"),
                ]
            ),
            DATE,
            False,
        ),
    )

    print(f"saved {len(list(OUT_DIR.glob('*.jpeg')))} images -> {OUT_DIR}")


if __name__ == "__main__":
    main()

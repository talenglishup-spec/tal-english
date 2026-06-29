import re
import csv
import os

SUMMARY_FILE = r"c:\Users\sangha.lee\Desktop\TAL\lesson_summary.txt"
OUTPUT_FILE = r"c:\Users\sangha.lee\Desktop\TAL\football-trainer\data\content_intake_import.csv"

HEADERS = [
    'active', 'player_id', 'lesson_no', 'lesson_title_ko', 'situation_order',
    'situation_title_ko', 'item_order', 'category', 'subtype', 'practice_type',
    'prompt_kr', 'target_en', 'cloze_target', 'expected_phrases', 'max_latency_ms',
    'pattern_type', 'hint_guide', 'notes', 'item_id_override', 'lesson_id_override',
    'situation_id_override'
]

def clean_expression(expr):
    # Remove markers
    expr = re.sub(r'^[•\-\*]\s*', '', expr).strip()
    
    # Known noise words
    noise_words = ['Verb', 'Noun', 'Adjective', '뜻', '의미', '자주 쓰이는', '예시', '설명', '관련 표현', '해석', '비교']
    for word in noise_words:
        if word.lower() in expr.lower():
            return None
            
    # Remove leading numbers like "1. ", "2. "
    expr = re.sub(r'^\d+\.\s*', '', expr).strip()
    
    # If it contains Korean, try to extract the English part
    if re.search(r'[가-힣]', expr):
        parts = re.split(r'[:→=]', expr)
        if len(parts) > 1:
            eng_part = parts[0].strip()
            # Verify English part doesn't have Korean
            if not re.search(r'[가-힣]', eng_part) and len(eng_part) > 2:
                return eng_part
        return None
    
    if len(expr) < 2:
        return None
        
    return expr

def determine_category(topics_str):
    topics_str = topics_str.lower()
    if 'interview' in topics_str or '인터뷰' in topics_str:
        return 'interview'
    if 'training' in topics_str or '훈련' in topics_str or '전술' in topics_str or '포지션' in topics_str or '교체' in topics_str:
        return 'on-pitch'
    if '일상' in topics_str or '식당' in topics_str or '부상' in topics_str or '컨디션' in topics_str:
        return 'life'
    return 'mixed'

def main():
    if not os.path.exists(SUMMARY_FILE):
        print(f"Error: {SUMMARY_FILE} not found.")
        return
        
    with open(SUMMARY_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    blocks = re.split(r'📁\s*(Day \d+_[^\n]+|Week \d+[^\n]*)', content)
    
    rows = []
    lesson_count = 0
    
    for i in range(1, len(blocks), 2):
        folder_name = blocks[i].strip()
        block_text = blocks[i+1]
        
        lesson_no = 0
        match_day = re.search(r'Day (\d+)', folder_name)
        if match_day:
            lesson_no = int(match_day.group(1))
        else:
            match_week = re.search(r'Week (\d+)', folder_name)
            if match_week:
                lesson_no = int(match_week.group(1))
                
        if not lesson_no:
            continue
            
        topic_match = re.search(r'🏷️ 주제:\s*([^\n]+)', block_text)
        lesson_title_ko = topic_match.group(1).strip() if topic_match else "핵심 표현 학습"
        
        category = determine_category(lesson_title_ko)
        
        expr_match = re.search(r'🗣️ 핵심 표현[^\n]*:([\s\S]*?)(?:─{10,}|\Z)', block_text)
        expressions = []
        if expr_match:
            expr_lines = expr_match.group(1).strip().split('\n')
            for line in expr_lines:
                clean_expr = clean_expression(line)
                if clean_expr:
                    if clean_expr not in expressions:
                        expressions.append(clean_expr)
                        
        if expressions:
            lesson_count += 1
            for idx, expr in enumerate(expressions, 1):
                row = {
                    'active': 'TRUE',
                    'player_id': 'P001',
                    'lesson_no': lesson_no,
                    'lesson_title_ko': lesson_title_ko,
                    'situation_order': 1,
                    'situation_title_ko': 'Core Expressions',
                    'item_order': idx,
                    'category': category,
                    'subtype': '',
                    'practice_type': 'expression',
                    'prompt_kr': '',
                    'target_en': expr,
                    'cloze_target': '',
                    'expected_phrases': '',
                    'max_latency_ms': 3000,
                    'pattern_type': '',
                    'hint_guide': '',
                    'notes': '',
                    'item_id_override': '',
                    'lesson_id_override': '',
                    'situation_id_override': ''
                }
                rows.append(row)
            
    rows.sort(key=lambda x: x['lesson_no'])
    
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=HEADERS)
        writer.writeheader()
        writer.writerows(rows)
        
    print(f"✅ Generated {len(rows)} expressions across {lesson_count} lessons.")
    print(f"✅ Output saved to: {OUTPUT_FILE}")

if __name__ == '__main__':
    main()

from nouns_theory import T, S

# Explicit reviewed paradigms, never inferred from an article or a suffix rule.
# A | marks only the visual ending; joining the two parts gives the spoken form.
# Sources: SAOL/SO (svenska.se), KTH Folkets lexikon and ISOF Frågelådan 28944.
# Reviewed forms and references: docs/NOUN_TABLES_024_REVIEW.md.
PARADIGMS = {
 'en bok': ('bok', 'bok|en', 'böck|er', 'böck|erna'),
 'en penna': ('penna', 'penna|n', 'penn|or', 'penn|orna'),
 'en stol': ('stol', 'stol|en', 'stol|ar', 'stol|arna'),
 'ett bord': ('bord', 'bord|et', 'bord', 'bord|en'),
 'ett fönster': ('fönster', 'fönstr|et', 'fönster', 'fönstr|en'),
 'en lampa': ('lampa', 'lampa|n', 'lamp|or', 'lamp|orna'),
 'en soffa': ('soffa', 'soffa|n', 'soff|or', 'soff|orna'),
 'en lägenhet': ('lägenhet', 'lägenhet|en', 'lägenhet|er', 'lägenhet|erna'),
 'ett rum': ('rum', 'rumm|et', 'rum', 'rumm|en'),
 'ett kök': ('kök', 'kök|et', 'kök', 'kök|en'),
 'ett hus': ('hus', 'hus|et', 'hus', 'hus|en'),
 'en lärare': ('lärare', 'lärare|n', 'lärare', 'lärar|na'),
 'en granne': ('granne', 'granne|n', 'grann|ar', 'grann|arna'),
 'en katt': ('katt', 'katt|en', 'katt|er', 'katt|erna'),
 'ett barn': ('barn', 'barn|et', 'barn', 'barn|en'),
 'ett djur': ('djur', 'djur|et', 'djur', 'djur|en'),
 'ett syskon': ('syskon', 'syskon|et', 'syskon', 'syskon|en'),
 'en kopp': ('kopp', 'kopp|en', 'kopp|ar', 'kopp|arna'),
 'en smörgås': ('smörgås', 'smörgås|en', 'smörgås|ar', 'smörgås|arna'),
 'en bulle': ('bulle', 'bulle|n', 'bull|ar', 'bull|arna'),
 'ett glas': ('glas', 'glas|et', 'glas', 'glas|en'),
 'ett äpple': ('äpple', 'äpple|t', 'äpple|n', 'äpple|na'),
 'ett ägg': ('ägg', 'ägg|et', 'ägg', 'ägg|en'),
 'en bil': ('bil', 'bil|en', 'bil|ar', 'bil|arna'),
 'en sko': ('sko', 'sko|n', 'sko|r', 'sko|rna'),
}


def noun_table_labels():
 return dict(
  word=T('Слово с артиклем','Слово з артиклем','Word with article','Ord med artikel'),
  singular=T('Единственное число','Однина','Singular','Singular'),
  plural=T('Множественное число','Множина','Plural','Plural'),
  indefinite=T('Неопределённая','Неозначена','Indefinite','Obestämd'),
  definite=T('Определённая','Означена','Definite','Bestämd'),
  translation=T('Перевод','Переклад','Translation','Betydelse'),
  indefiniteLegend=T('Неопределённая: называем предметы, не уточняя какие.','Неозначена: називаємо предмети, не уточнюючи які.','Indefinite: name items without identifying which ones.','Obestämd: vi nämner saker utan att ange vilka.'),
  definiteLegend=T('Определённая: понятно, о каком предмете или каких предметах идёт речь.','Означена: зрозуміло, про який предмет або які предмети йдеться.','Definite: it is clear which item or items we mean.','Bestämd: det är tydligt vilken sak eller vilka saker vi menar.'),
  overview=T('Это обзор форм. Сейчас запоминай слово с en/ett; определённую форму подробно разберём в уроке №6. Окончания выделены цветом. Гласные тоже могут меняться, а plural бывает без окончания.','Це огляд форм. Зараз запам’ятовуй слово з en/ett; означену форму докладно розглянемо в уроці №6. Закінчення виділено кольором. Голосні теж можуть змінюватися, а plural буває без закінчення.','This is an overview. Learn each word with en/ett now; lesson 6 explains the definite form in detail. Endings are highlighted. Vowels can also change, and some plurals have no ending.','Det här är en översikt. Lär in orden med en/ett nu; lektion 6 förklarar bestämd form närmare. Ändelser är markerade. Vokaler kan också ändras, och vissa pluralformer saknar ändelse.')
 )


def add_tables(c):
 def table(id,section,title,headers,rows):
  c['tables'].append(dict(id=id,section=section,title=title,headers=headers,rows=[dict(cells=[S(x) if isinstance(x,str) else x for x in cells],sv=audio) for cells,audio in rows]))
 meaning=T('Значение','Значення','Meaning','Betydelse')
 c['nounTableLabels'] = noun_table_labels()
 def vocab(id,title,words,section='basics',note=None):
  labels=c['nounTableLabels']
  headers=[labels['word'],
   T('Singular obestämd — единственное число, неопределённая форма','Singular obestämd — однина, неозначена форма','Singular obestämd — singular, indefinite','Singular obestämd'),
   T('Singular bestämd — единственное число, определённая форма','Singular bestämd — однина, означена форма','Singular bestämd — singular, definite','Singular bestämd'),
   T('Plural obestämd — множественное число, неопределённая форма','Plural obestämd — множина, неозначена форма','Plural obestämd — plural, indefinite','Plural obestämd'),
   T('Plural bestämd — множественное число, определённая форма','Plural bestämd — множина, означена форма','Plural bestämd — plural, definite','Plural bestämd'),labels['translation']]
  rows=[]
  for word,r,u,e in words:
   parts=[form.split('|') if '|' in form else [form,''] for form in PARADIGMS[word]]
   forms=[''.join(p) for p in parts]
   rows.append(dict(cells=[S(word),*[S(form) for form in forms],T(r,u,e,forms[0])],sv=word,formParts=parts))
  c['tables'].append(dict(id=id,section=section,title=title,kind='noun-forms',headers=headers,rows=rows,**({'note':note} if note else {})))
 vocab('classroom',T('В классе: en и ett','У класі: en та ett','In class: en and ett','I klassrummet: en och ett'),[
 ('en bok','книга','книжка','book'),('en penna','ручка','ручка','pen'),('en stol','стул','стілець','chair'),('ett bord','стол','стіл','table'),('ett fönster','окно','вікно','window')])
 vocab('home',T('Дома: мебель и комнаты','Удома: меблі й кімнати','At home: furniture and rooms','Hemma: möbler och rum'),[
 ('en lampa','лампа','лампа','lamp'),('en soffa','диван','диван','sofa'),('en lägenhet','квартира','квартира','apartment'),('ett rum','комната','кімната','room'),('ett kök','кухня','кухня','kitchen'),('ett hus','дом','будинок','house')])
 vocab('living',T('Люди и животные: разные роды','Люди й тварини: різні роди','People and animals: both genders','Människor och djur: båda genus'),[
 ('en lärare','преподаватель','викладач','teacher'),('en granne','сосед','сусід','neighbour'),('en katt','кошка','кішка','cat'),('ett barn','ребёнок','дитина','child'),('ett djur','животное','тварина','animal'),('ett syskon','брат или сестра','брат або сестра','sibling')])
 vocab('cafe',T('В кафе: еда и порции','У кафе: їжа й порції','At the café: food and servings','På kafé: mat och portioner'),[
 ('en kopp','чашка','чашка','cup'),('en smörgås','бутерброд','бутерброд','sandwich'),('en bulle','булочка','булочка','bun'),('ett glas','стакан','склянка','glass'),('ett äpple','яблоко','яблуко','apple'),('ett ägg','яйцо','яйце','egg')])
 vocab('gender-map',T('Род и четыре формы','Рід і чотири форми','Gender and four forms','Genus och fyra former'),[
 ('en bil','машина','автомобіль','car'),('ett hus','дом','будинок','house'),('en stol','стул','стілець','chair'),('ett äpple','яблоко','яблуко','apple')],section='gender',note=T('En — utrum; ett — neutrum. Сравни: en stor bil / ett stort hus, en röd stol / ett rött äpple.','En — utrum; ett — neutrum. Порівняй: en stor bil / ett stort hus, en röd stol / ett rött äpple.','En marks utrum; ett marks neutrum. Compare: en stor bil / ett stort hus, en röd stol / ett rött äpple.','En anger utrum; ett anger neutrum. Jämför: en stor bil / ett stort hus, en röd stol / ett rött äpple.'))
 table('clues','gender',T('Насколько надёжна подсказка?','Наскільки надійна підказка?','How reliable is the clue?','Hur säker är ledtråden?'),[T('Подсказка','Підказка','Clue','Ledtråd'),T('Пример','Приклад','Example','Exempel'),T('Ограничение','Обмеження','Limit','Begränsning')],[
 ([S('-het / -ning'),S('en möjlighet / en tidning'),T('Надёжная словообразовательная подсказка; учи слово целиком.','Надійна словотвірна підказка; учи ціле слово.','Strong derivational clue; learn the whole word.','Stark avledningsledtråd; lär in hela ordet.')],'en möjlighet, en tidning'),
 ([T('Человек или животное','Людина чи тварина','Person or animal','Person eller djur'),S('en katt / ett barn'),T('Тенденция, не правило без исключений.','Тенденція, не правило без винятків.','A tendency with important exceptions.','En tendens med viktiga undantag.')],'en katt, ett barn'),
 ([S('-a'),S('en lampa / ett öga'),T('Последняя буква ненадёжна.','Остання літера ненадійна.','The final letter is unreliable.','Slutbokstaven är osäker.')],'en lampa, ett öga'),
 ([T('Последняя часть сложного слова','Остання частина складного слова','Final part of a compound','Slutled i sammansättning'),S('ett rum → ett sovrum'),T('Для обычных сложных существительных; проверь незнакомое слово.','Для звичайних складних іменників; перевір незнайоме слово.','Works for ordinary noun compounds; check unfamiliar words.','Gäller vanliga sammansatta substantiv; kontrollera okända ord.')],'ett rum, ett sovrum')])
 table('article-context','usage',T('С артиклем или без?','З артиклем чи без?','With or without an article?','Med eller utan artikel?'),[T('Ситуация','Ситуація','Situation','Situation'),T('Естественная фраза','Природна фраза','Natural expression','Naturligt uttryck'),T('Почему','Чому','Why','Varför')],[
 ([T('Новый предмет','Новий предмет','New item','Ny sak'),'Jag köper en stol.',T('Один исчисляемый предмет.','Один злічуваний предмет.','One countable item.','En räkningsbar sak.')],'Jag köper en stol.'),
 ([T('Вещество','Речовина','Substance','Ämne'),'Jag dricker vatten.',T('Без счёта отдельных предметов.','Без лічби окремих предметів.','No individual items counted.','Inga enskilda saker räknas.')],'Jag dricker vatten.'),
 ([T('Профессия','Професія','Profession','Yrke'),'Hon är lärare.',T('Нейтральное название профессии.','Нейтральна назва професії.','Neutral profession label.','Neutral yrkesbeteckning.')],'Hon är lärare.'),
 ([T('Принадлежность','Належність','Possession','Ägande'),'min bok / mitt hus',T('Min/mitt заменяет артикль.','Min/mitt замінює артикль.','Min/mitt replaces the article.','Min/mitt ersätter artikeln.')],'min bok, mitt hus'),
 ([T('Количество','Кількість','Quantity','Antal'),'två böcker',T('После två — plural без en/ett.','Після två — plural без en/ett.','After två use plural without en/ett.','Efter två: plural utan en/ett.')],'två böcker')])
 table('sentence-patterns','usage',T('Схемы для живой речи','Схеми для мовлення','Patterns for real speech','Mönster för samtal'),[T('Задача','Завдання','Purpose','Syfte'),T('Схема','Схема','Pattern','Mönster'),T('Пример и перевод','Приклад і переклад','Example and meaning','Exempel och betydelse')],[
 ([T('Сказать о наличии','Сказати про наявність','Express possession','Ange innehav'),'jag / hon / vi → har → en/ett + substantiv',T('Jag har en bil. — У меня машина.','Jag har en bil. — Я маю машину.','Jag har en bil. — I have a car.','Jag har en bil. — Jag äger en bil.')],'Jag har en bil.'),
 ([T('Попросить','Попросити','Request','Be om något'),'jag → behöver → en/ett + substantiv',T('Jag behöver ett glas. — Мне нужен стакан.','Jag behöver ett glas. — Мені потрібна склянка.','Jag behöver ett glas. — I need a glass.','Jag behöver ett glas. — Jag saknar ett glas.')],'Jag behöver ett glas.'),
 ([T('Представить предмет','Представити предмет','Present an item','Presentera en sak'),'det här → är → en/ett + substantiv',T('Det här är en lampa. — Это лампа.','Det här är en lampa. — Це лампа.','Det här är en lampa. — This is a lamp.','Det här är en lampa. — Saken är en lampa.')],'Det här är en lampa.'),
 ([T('Описать место','Описати місце','Describe a place','Beskriv en plats'),'här → finns → en/ett + substantiv',T('Här finns ett kök. — Здесь есть кухня.','Här finns ett kök. — Тут є кухня.','Här finns ett kök. — There is a kitchen here.','Här finns ett kök. — Ett kök finns här.')],'Här finns ett kök.')])
 vocab('definite-map',T('Четыре формы: сравни один и несколько','Чотири форми: порівняй один і кілька','Four forms: compare one and several','Fyra former: jämför en och flera'),[
 ('en bok','книга','книжка','book'),('en stol','стул','стілець','chair'),('en lampa','лампа','лампа','lamp'),('ett hus','дом','будинок','house'),('ett äpple','яблоко','яблуко','apple'),('ett fönster','окно','вікно','window')],section='forms')
 vocab('plural-map',T('Plural: разные способы образования','Plural: різні способи утворення','Plural: different patterns','Plural: olika mönster'),[
 ('en lampa','лампа','лампа','lamp'),('en stol','стул','стілець','chair'),('en bok','книга','книжка','book'),('en sko','туфля','туфля','shoe'),('ett äpple','яблоко','яблуко','apple'),('ett hus','дом','будинок','house'),('ett barn','ребёнок','дитина','child')],section='forms')
 table('adjective-map','forms',T('Сравни согласование','Порівняй узгодження','Compare adjective agreement','Jämför adjektivböjningen'),[S('en-ord'),S('ett-ord'),meaning],[(['en stor bil','ett stort hus',T('большая машина / большой дом','велика машина / великий будинок','a large car / a large house','stor beskriver bil, stort beskriver hus')],'en stor bil, ett stort hus'),(['en röd stol','ett rött äpple',T('красный стул / красное яблоко','червоний стілець / червоне яблуко','a red chair / a red apple','röd beskriver stol, rött beskriver äpple')],'en röd stol, ett rött äpple'),(['Bilen är stor.','Huset är stort.',T('Согласование после är.','Узгодження після är.','Agreement after är.','Böjning efter är.')],'Bilen är stor. Huset är stort.')])
 table('error-map','reference',T('Проверь и исправь','Перевір і виправ','Check and correct','Kontrollera och rätta'),[T('Ошибка','Помилка','Error','Fel'),T('Правильно','Правильно','Correct','Rätt'),T('Причина','Причина','Reason','Orsak')],[
 (['ett bil','en bil',T('Bil — en-слово.','Bil — en-слово.','Bil is an en-word.','Bil är en-ord.')],'en bil'),(['en barn','ett barn',T('Живое не означает en.','Живе не означає en.','Alive does not mean en.','Levande betyder inte alltid en.')],'ett barn'),(['boket','boken',T('Род определяет окончание.','Рід визначає закінчення.','Gender affects the suffix.','Genus påverkar ändelsen.')],'boken'),(['ett stor hus','ett stort hus',T('Stort согласуется с hus.','Stort узгоджується з hus.','Stort agrees with hus.','Stort hör till hus.')],'ett stort hus'),(['min boken','min bok',T('После min нет -en.','Після min немає -en.','No -en after min.','Ingen -en efter min.')],'min bok')])
 table('quick-reference','reference',T('Шпаргалка: одно слово в речи','Шпаргалка: одне слово в мовленні','Quick reference: one word in use','Snabbguide: ett ord i tal'),[T('Смысл','Зміст','Meaning','Betydelse'),T('Пример','Приклад','Example','Exempel'),T('Самопроверка','Самоперевірка','Self-check','Egen kontroll')],[
 ([T('Новое','Нове','New','Nytt'),'ett hus',T('Знаю род?','Знаю рід?','Do I know the gender?','Kan jag genus?')],'ett hus'),([T('Известное','Відоме','Known','Känt'),'huset',T('Можно узнать предмет?','Можна впізнати предмет?','Can the item be identified?','Kan saken identifieras?')],'huset'),([T('Моё','Моє','Mine','Mitt'),'mitt hus',T('После mitt без -et?','Після mitt без -et?','No -et after mitt?','Utan -et efter mitt?')],'mitt hus'),([T('Несколько','Кілька','Several','Flera'),'två hus',T('Проверил plural?','Перевірив plural?','Did I check the plural?','Har jag kollat plural?')],'två hus'),([T('Описание','Опис','Description','Beskrivning'),'ett stort hus',T('Прилагательное согласовано?','Прикметник узгоджено?','Does the adjective agree?','Är adjektivet rätt böjt?')],'ett stort hus')])

"""Build local dictionary thumbnails from Microsoft's MIT-licensed Fluent 3D icons.
Run from the project root; requires Pillow and internet access. Outputs are committed
so the application never contacts a third-party icon service at runtime.
"""
import concurrent.futures
import io
import json
from pathlib import Path
import re
import unicodedata
import urllib.parse
import urllib.request
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets' / 'word-icons'
BASE = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/'

def fetch(path):
    return urllib.request.urlopen(BASE + urllib.parse.quote(path, safe='/'), timeout=40).read()

def norm(text):
    return text.replace('\ufe0f', '')

# Unicode's formal names sometimes differ from Fluent's descriptive asset names.
ALIASES = {
 '↔':'Left-right arrow','↩':'Right arrow curving left','⌛':'Hourglass done','⏳':'Hourglass not done',
 '⏩':'Fast-forward button','⏭':'Next track button','⏮':'Last track button','▶':'Play button',
 '☀':'Sun','☝':'Index pointing up','♾':'Infinity','⚖':'Balance scale','⚡':'High voltage',
 '⚪':'White circle','⚫':'Black circle','✅':'Check mark button','❓':'Red question mark',
 '❔':'White question mark','❤':'Red heart','➕':'Plus','➡':'Right arrow','⬅':'Left arrow',
 '⬆':'Up arrow','⬇':'Down arrow','🌇':'Sunset','🌤':'Sun behind small cloud',
 '🌦':'Sun behind rain cloud','🌬':'Wind face','🎁':'Wrapped gift','🎒':'Backpack',
 '🎣':'Fishing pole','🎯':'Bullseye','🏃':'Person running','🏋':'Person lifting weights',
 '🏠':'House','🐑':'Ewe','🐻':'Bear','👉':'Backhand index pointing right','👋':'Waving hand',
 '👍':'Thumbs up','👎':'Thumbs down','👟':'Running shoe','👧👦':'Busts in silhouette',
 '👨‍👧':'People hugging','👨‍👩‍👧':'People hugging','👩‍⚕':'Woman health worker',
 '👩‍🍳':'Woman cook','👩‍🏫':'Woman teacher','👩‍💻':'Woman technologist',
 '👪':'People hugging','👫':'Two hearts','👭':'Busts in silhouette',
 '👰':'Person with veil','👴':'Old man','👵':'Old woman','💡':'Light bulb','💤':'Zzz',
 '💯':'Hundred points','💻':'Laptop','📧':'E-mail','🔀':'Shuffle tracks button',
 '🔁':'Repeat button','🔄':'Counterclockwise arrows button','🔎':'Magnifying glass tilted right',
 '🔒':'Locked','🔗':'Link','🔙':'Back arrow','🔟':'Keycap 10','🔠':'Input latin uppercase',
 '🔢':'Input numbers','🔤':'Input latin letters','🔴':'Red circle','🔵':'Blue circle',
 '🖼':'Framed picture','🗓':'Spiral calendar','🗣':'Speaking head',
 '😄':'Grinning face with smiling eyes','🙋':'Person raising hand','🙏':'Folded hands',
 '🚙':'Sport utility vehicle','🚫':'Prohibited','🚴':'Person biking','🚶':'Person walking',
 '🛑':'Stop sign','🛒':'Shopping cart','🟡':'Yellow circle','🟢':'Green circle',
 '🟣':'Purple circle','🟤':'Brown circle','🥵':'Hot face','🥶':'Cold face','🧊':'Ice',
 '🧍':'Person standing','🧑‍🏫':'Teacher','🧩':'Puzzle piece','🧼':'Soap',
}
for number in range(1,10):
    ALIASES[str(number)+'\u20e3'] = 'Keycap '+str(number)

# Exact Swedish lemmas take precedence over broad category emoji in the source data.
GROUPS = {
 'Briefcase':'arbeta jobba jobb arbete arbetsplats arbetsgivare anställd anställning ansvar',
 'Speaking head':'prata säga berätta förklara språk svenska svensk',
 'Open book':'studera läsa bok lärobok ordbok',
 'Shopping cart':'handla kundvagn mataffär',
 'Cooking':'laga kök spis ugn steka',
 'Credit card':'betala kort bankkort kontokort kassa',
 'Red question mark':'fråga varför vad',
 'Speech balloon':'svara svar meddelande sms mening ord',
 'Ear':'lyssna öra', 'Eyes':'titta se', 'Hourglass not done':'vänta försening',
 'Play button':'börja', 'Stop button':'sluta stanna', 'Alarm clock':'vakna väckarklocka',
 'Person lifting weights':'träna gym', 'Soccer ball':'spela fotboll idrott',
 'Soap':'tvätta skölja', 'Door':'öppna dörr', 'Locked':'stänga lås stängt lösenord',
 'Toolbox':'använda göra verktyg', 'Light bulb':'tända lampa ljus',
 'Pouring liquid':'fylla', 'Brick':'bygga vägg', 'Shopping bags':'köpa butik affär köpcentrum',
 'Airplane':'resa flygplan flygplats', 'Bus':'åka buss',
 'Magnifying glass tilted right':'söka undersökning nyfiken', 'Teddy bear':'leka leksak',
 'Thinking face':'tänka tycka kanske förstå', 'Handshake':'hjälpa vän kollega tillsammans',
 'House':'bo hus hem hemma bostad hyra', 'Folded hands':'tro tack tacksam',
 'Smiling face':'må frisk pigg', 'Sewing needle':'sy', 'Bullseye':'nå',
 'Person standing':'vara stå', 'Open hands':'ha få ta hämta', 'Person walking':'gå promenera',
 'Person walking facing right':'komma', 'Writing hand':'skriva', 'Cup with straw':'dricka dryck juice',
 'Fork and knife with plate':'äta mat middag lunch hungrig restaurang', 'Sleeping face':'sova trött',
 'Person running':'springa snabb', 'Brain':'veta erfarenhet', 'Flexed biceps':'kunna stark',
 'Sparkling heart':'vilja gärna', 'Wrapped gift':'ge', 'Bed':'ligga säng sovrum vila',
 'Chair':'sitta stol', 'Automobile':'bil', 'House with garden':'villa',
 'Girl':'flicka dotter', 'Boy':'pojke son', 'Woman':'kvinna mamma mor moster faster',
 'Man':'man pappa far morbror farbror', 'School':'skola klassrum klass',
 'Window':'fönster', 'Laptop':'dator skärm', 'Mobile phone':'mobil telefon app',
 'Red apple':'äpple', 'Banana':'banan', 'Cat':'katt kattunge', 'Dog':'hund valp',
 'People hugging':'familj släkt föräldrar förälder barnbarn kusin syskon',
 'Sun':'dag sol solig skiner', 'Spiral calendar':'vecka schema tidtabell',
 'Calendar':'år månad datum termin', 'Teacher':'lärare', 'Pen':'penna',
 'Child':'barn', 'Fish':'fisk lax', 'Bicycle':'cykel cykla', 'Watch':'klocka',
 'Waving hand':'hej hejdå välkommen', 'Check mark button':'ja bra', 'Cross mark':'nej dålig',
 'Red circle':'röd', 'Blue circle':'blå', 'Green circle':'grön', 'Yellow circle':'gul',
 'White circle':'vit', 'Black circle':'svart', 'Brown circle':'brun', 'Purple circle':'lila',
 'Pink heart':'rosa', 'Old woman':'mormor farmor', 'Old man':'morfar farfar gammal',
 'New button':'ny', 'Star':'fin stjärna', 'Fire':'varm varmt eld grilla', 'Snowflake':'kall kallt vinter',
 'Turtle':'långsam', 'Feather':'lätt', 'Puzzle piece':'svår uppgift',
 'Grinning face with smiling eyes':'glad', 'Crying face':'ledsen', 'Face with thermometer':'sjuk feber',
 'Face screaming in fear':'rädd', 'Angry face':'arg', 'Person in lotus position':'lugn yoga',
 'Droplet':'vatten törstig', 'Hot beverage':'kaffe kafé', 'Teacup without handle':'te',
 'Glass of milk':'mjölk', 'Bread':'bröd', 'Butter':'smör', 'Cheese wedge':'ost',
 'Egg':'ägg', 'Cut of meat':'kött skinka', 'Poultry leg':'kyckling', 'Cooked rice':'ris',
 'Potato':'potatis', 'Tomato':'tomat', 'Cucumber':'gurka', 'Onion':'lök', 'Carrot':'morot',
 'Pot of food':'soppa gröt koka', 'Croissant':'frukost', 'Money bag':'pengar lön skatt pris',
 'Receipt':'kvitto', 'Money with wings':'billigt billig rabatt rea erbjudande',
 'Gem stone':'dyr dyrt', 'Straight ruler':'storlek bred smal lång', 'Artist palette':'färg måla',
 'Coat':'jacka kappa', 'T-shirt':'tröja skjorta t-shirt blus kläder', 'Jeans':'byxor jeans shorts',
 'Dress':'klänning kjol', 'Running shoe':'skor sneakers', 'Billed cap':'mössa',
 'Gloves':'vantar handskar', 'Scarf':'halsduk', 'Socks':'strumpor strumpa',
 'Cloud with rain':'regn regnar regnig', 'Cloud with snow':'snö snöar snöig',
 'Wind face':'vind blåsig luft', 'Cloud':'moln molnig', 'Sun behind rain cloud':'väder',
 'Sun with face':'sommar', 'Fallen leaf':'höst löv', 'Two hearts':'gift fru sambo',
 'Office building':'lägenhet kontor företag', 'Bathtub':'badrum', 'Couch and lamp':'soffa vardagsrum fåtölj',
 'Key':'nyckel', 'Train':'tåg', 'Sailboat':'båt', 'Station':'station perrong',
 'Bus stop':'hållplats busshållplats', 'Ticket':'biljett enkelbiljett', 'Motorway':'väg gata',
 'World map':'karta region', 'Hospital':'sjukhus vårdcentral', 'Health worker':'läkare sjuksköterska',
 'Pill':'apotek medicin tablett', 'Eye':'öga', 'Nose':'näsa', 'Mouth':'mun läpp',
 'Raised hand':'hand', 'Leg':'ben knä', 'Foot':'fot tå', 'Person':'huvud hår panna ansikte',
 'Pregnant person':'mage', 'Face with head-bandage':'ont skada huvudvärk smärta',
 'Face with medical mask':'hosta symptom', 'Sneezing face':'förkyld allergi',
 'Student':'elev student utbildning', 'Backpack':'läxa ryggsäck', 'Memo':'prov betyg anteckning',
 'Books':'lektion kurs ämne bibliotek', 'Pencil':'blyertspenna', 'Notebook':'anteckningsbok',
 'Card index dividers':'pärm', 'Electric plug':'laddare eluttag sladd', 'Globe with meridians':'internet hemsida nätverk',
 'E-mail':'e-post', 'Framed picture':'bild', 'Clapper board':'film video bio', 'Musical notes':'musik',
 'Video game':'spel', 'Fishing pole':'fiske fiska', 'Beach with umbrella':'strand kust',
 'Water wave':'hav sjö flod bäck', 'Evergreen tree':'skog', 'Deciduous tree':'träd gren rot',
 'Tulip':'blomma', 'Bird':'fågel', 'Horse':'häst', 'Cow':'ko kalv', 'Pig':'gris', 'Ewe':'får lamm',
 'Rabbit':'kanin', 'Bear':'björn', 'Moose':'älg', 'Tooth':'tand tandvärk', 'Tongue':'tunga',
 'Thumbs up':'tumme stolt', 'Anatomical heart':'hjärta', 'Drop of blood':'blod', 'Syringe':'vaccination',
 'Ambulance':'ambulans', 'Collision':'olycka', 'Stethoscope':'recept', 'Keyboard':'tangentbord',
 'Mirror':'spegel', 'Locked with key':'lås', 'Ice':'frys kylskåp', 'Spaghetti':'pasta',
 'Green salad':'sallad', 'Shrimp':'räkor', 'Hot dog':'korv', 'Garlic':'vitlök',
 'Bell pepper':'paprika', 'Mushroom':'svamp', 'Pear':'päron', 'Tangerine':'apelsin',
 'Lemon':'citron', 'Strawberry':'jordgubbe', 'Candy':'socker', 'Salt':'salt peppar', 'Honey pot':'honung',
 'Basket':'korg', 'Package':'paket leverans', 'Postbox':'post postombud', 'Tram':'spårvagn',
 'Metro':'tunnelbana', 'Taxi':'taxi', 'Ferry':'färja', 'Airplane departure':'avgång avresa',
 'Airplane arrival':'ankomst', 'Vertical traffic light':'trafikljus trafiken', 'P button':'parkering',
 'Fuel pump':'bensin diesel', 'Sunrise':'morgon förmiddag', 'Cityscape at dusk':'kväll',
 'Milky way':'natt midnatt', 'Womans boot':'stövlar', 'Top hat':'hatt', 'Handbag':'väska',
 'Fog':'dimma', 'Cloud with lightning and rain':'storm åska', 'High voltage':'blixt',
 'Thermometer':'temperatur grad', 'Umbrella with rain drops':'paraply',
 'Busts in silhouette':'möte intervju chef kund invånare', 'Page facing up':'ansökan cv blankett',
 'Hourglass done':'arbetstid timlön heltid deltid skift', 'Desert island':'semester ledig ö',
 'Cityscape':'stad centrum', 'Houses':'by', 'National park':'park natur miljö', 'Bridge at night':'bro',
 'Church':'kyrka', 'Classical building':'museum myndighet kommun demokrati samhälle',
 'Performing arts':'teater', 'Person swimming':'simhall simma', 'Playground slide':'lekplats',
 'Police officer':'polis', 'Oncoming police car':'polisstation', 'Bank':'bank bankkonto',
 'Atm sign':'uttagsautomat', 'Recycling symbol':'återvinningscentral återvinna sortera',
 'Duck':'anka', 'Chicken':'höna', 'Rooster':'tupp', 'Goat':'get', 'Mouse':'mus råtta',
 'Fox':'räv', 'Wolf':'varg', 'Deer':'rådjur', 'Chipmunk':'ekorre', 'Butterfly':'fjäril',
 'Honeybee':'bi', 'Mosquito':'mygga', 'Fly':'fluga', 'Ant':'myra', 'Spider':'spindel',
 'Herb':'gräs', 'Rock':'sten berg', 'Crescent moon':'måne', 'Rainbow':'regnbåge',
 'Orange circle':'orange', 'Broom':'städa sopa', 'Sponge':'diska torka', 'Wastebasket':'kasta',
 'Kitchen knife':'skära hacka', 'Shortcake':'baka', 'Hammer and wrench':'reparera',
 'Battery':'batteri', 'Wireless':'wifi', 'Bust in silhouette':'konto personnummer',
 'Printer':'skrivare', 'Camera':'kamera fotografera', 'Headphone':'hörlurar', 'Microphone':'mikrofon sjunga',
 'Page with curl':'fil', 'File folder':'mapp', 'Counterclockwise arrows button':'uppdatering', 'Link':'länk',
 'Woman dancing':'dansa', 'Basketball':'basket', 'Tennis':'tennis', 'Ice hockey':'ishockey',
 'Hiking boot':'vandring vandra', 'Guitar':'konsert gitarr', 'Confetti ball':'festival',
 'Anxious face with sweat':'nervös orolig', 'Face with open mouth':'förvånad',
 'Flushed face':'generad', 'Broken heart':'besviken ensam', 'Smiling face with heart-eyes':'förälskad',
 'Shield':'försäkring rättighet', 'Scroll':'lag regel beslut kontrakt', 'Balance scale':'skyldighet',
 'Ballot box with ballot':'val röst', 'Hotel':'hotell', 'Bellhop bell':'reception', 'Passport control':'pass',
 'Luggage':'bagage resväska', 'Compass':'turist sevärdhet vägvisning',
 'Chess pawn':'schack', 'Ice skate':'skridskor', 'Yarn':'sticka', 'Camping':'campa', 'Pool 8 ball':'biljard',
 'Repeat button':'repetera upprepa', 'Globe showing europe-africa':'sverige',
}


def build():
    DEST.mkdir(parents=True, exist_ok=True)
    tree_path = ROOT / 'tmp' / 'fluent-tree.json'
    if not tree_path.exists():
        tree_path.parent.mkdir(exist_ok=True)
        tree_path.write_bytes(urllib.request.urlopen('https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/main?recursive=1').read())
    tree=json.loads(tree_path.read_text())['tree']
    paths={}
    for item in tree:
        path=item['path']
        if '/3D/' in path and path.endswith('.png') and ('/Default/' in path or path.count('/')==3):
            paths[path.split('/')[1].lower()]=path
    def resolve(name):
        key=name.lower()
        if key not in paths:
            raise ValueError('Unknown Fluent asset: '+name)
        return key
    # Validate manually curated names before fetching assets.
    manual={word:resolve(name) for name,words in GROUPS.items() for word in words.split()}
    # Common multiword lemmas and article/infinitive variants use the same meaning.
    manual.update({'laga mat':resolve('Cooking'),'må bättre':resolve('Smiling face'),
                   'må dåligt':resolve('Face with thermometer'),'lämna tillbaka':resolve('Left arrow'),
                   'gå på':resolve('Person walking'),'gå av':resolve('Person walking'),
                   'tur och retur':resolve('Repeat button'),'varmt ute':resolve('Sun'),
                   'frukost ingår':resolve('Croissant'),'ingen orsak':resolve('Folded hands')})
    def emoji_name(emoji):
        emoji=norm(emoji)
        if emoji in ALIASES:
            return resolve(ALIASES[emoji])
        name=' '.join(unicodedata.name(c,'') for c in emoji if c!='\u200d').lower()
        return resolve(name)
    words=json.loads((ROOT/'words.json').read_text())
    mapping={}
    for word in words:
        lemma=re.sub(r'^(?:att|en|ett) ', '', word['word'].lower()).rstrip('?')
        english=word['en'].lower()
        # Direct object names can refine broad category emoji (e.g. "duck").
        name=manual.get(lemma) or (english if english in paths else None)
        if not name:
            name=emoji_name(word['emoji'])
        mapping[word['id']]=name
    used=sorted(set(mapping.values()))
    print(f'{len(mapping)} word IDs, {len(used)} distinct 3D assets',flush=True)
    def download(name):
        filename=re.sub('[^a-z0-9]+','-',name).strip('-')+'.webp'
        target=DEST/filename
        if not target.exists():
            for attempt in range(3):
                try:
                    img=Image.open(io.BytesIO(fetch(paths[name]))).convert('RGBA')
                    img.thumbnail((128,128),Image.Resampling.LANCZOS)
                    img.save(target,'WEBP',quality=88,method=6)
                    break
                except Exception:
                    if attempt==2: raise
        return name,'./assets/word-icons/'+filename
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        files=dict(pool.map(download,used))
    manifest={key:files[name] for key,name in mapping.items()}
    (DEST/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'word-icons.js').write_text('/* Local Fluent 3D icons, matched to exact vocabulary IDs. MIT license: assets/word-icons/LICENSE. */\nwindow.svWordIcons = Object.freeze('+json.dumps(manifest,ensure_ascii=False,indent=2)+');\n')
    if not (DEST/'LICENSE').exists():
        (DEST/'LICENSE').write_bytes(fetch('LICENSE'))
    (DEST/'README.md').write_text('# Dictionary icons\n\nMicrosoft Fluent Emoji 3D, distributed under the MIT license included in LICENSE.\nSource: https://github.com/microsoft/fluentui-emoji\n\nThumbnails are 128px WebP with transparency. `manifest.json` maps each vocabulary ID to a local asset.\nRegenerate with `python3 scripts/build_word_icons.py` (requires Pillow and internet access).\n')
    print('Saved',len(files),'local icons; all vocabulary IDs mapped.',flush=True)

if __name__=='__main__':
    build()

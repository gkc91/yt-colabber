/**
 * One page per niche has to answer one search intent, so each niche gets its own
 * angle and its own first-60-seconds problem. Generic text repeated 14 times would
 * be a doorway page (GROWTH.md §4).
 */
import type { Locale } from './site';

interface NicheCopy {
  /** What the feed competition looks like in this niche. */
  feed: string;
  /** What usually goes wrong in the first 60 seconds here. */
  hook: string;
}

export const NICHE_COPY: Record<string, Record<Locale, NicheCopy>> = {
  animation: {
    en: {
      feed: 'Animation thumbnails live or die on a readable character pose and a single strong colour; next to studio-grade art, a busy frame reads as noise at feed size.',
      hook: 'Animated shorts usually lose people to a long intro card or a silent setup before the first joke or the first movement.',
    },
    tr: {
      feed: "Animasyon thumbnail'ları okunabilir bir karakter pozu ve tek güçlü bir renkle ayakta durur; stüdyo işlerinin yanında kalabalık bir kare feed boyutunda gürültüye dönüşür.",
      hook: 'Animasyon işleri izleyiciyi genelde uzun bir açılış kartına ya da ilk şakadan veya ilk hareketten önceki sessiz hazırlığa kaptırır.',
    },
  },
  gaming: {
    en: {
      feed: 'Gaming feeds are crowded with the same game key art, so the question is whether a viewer can tell in half a second that your video is about a different moment than the other five.',
      hook: 'Gaming videos lose people to menu screens, mic levels and thirty seconds of setup before anything is actually played.',
    },
    tr: {
      feed: "Oyun feed'i aynı oyunun aynı görselleriyle dolu; asıl soru, izleyicinin yarım saniyede senin videonun diğer beşinden farklı bir anı anlattığını anlayıp anlamadığı.",
      hook: 'Oyun videoları izleyiciyi menü ekranlarına, mikrofon seviyesine ve gerçekten oynanmaya başlamadan önceki otuz saniyelik hazırlığa kaptırır.',
    },
  },
  education: {
    en: {
      feed: 'Explainer thumbnails compete on the question, not the visual: if the promise is not legible in four words, the click goes to the channel that wrote it plainly.',
      hook: 'Explainers lose people when the answer is postponed — a minute of context before the question is even restated.',
    },
    tr: {
      feed: "Anlatım videolarının thumbnail'ı görselle değil soruyla yarışır: vaat dört kelimede okunmuyorsa tıklama, onu düz yazan kanala gider.",
      hook: 'Anlatım videoları cevabı ertelediğinde izleyiciyi kaybeder — soru tekrar edilmeden önce bir dakikalık giriş.',
    },
  },
  tech: {
    en: {
      feed: 'Tech thumbnails are judged against official product shots, so a review has to look like a verdict rather than a press image.',
      hook: 'Tech videos lose people to specs read aloud before anyone says what the thing is actually like to use.',
    },
    tr: {
      feed: "Teknoloji thumbnail'ları resmi ürün görselleriyle yan yana değerlendirilir; bir inceleme, basın görseli gibi değil, bir karar gibi görünmek zorundadır.",
      hook: 'Teknoloji videoları, o şeyi kullanmanın nasıl bir his olduğu söylenmeden önce sesli okunan teknik özelliklere izleyici kaptırır.',
    },
  },
  finance: {
    en: {
      feed: 'Finance feeds are full of red arrows and big numbers, so a specific claim usually beats a dramatic one — and viewers are quick to read hype as a warning sign.',
      hook: 'Finance videos lose people to disclaimers and credentials before the first concrete number appears.',
    },
    tr: {
      feed: "Finans feed'i kırmızı oklar ve büyük rakamlarla dolu; somut bir iddia genelde dramatik olanı geçer, üstelik izleyici abartıyı hızla uyarı işareti sayar.",
      hook: 'Finans videoları ilk somut rakam gelmeden önceki uyarılara ve özgeçmişe izleyici kaptırır.',
    },
  },
  fitness: {
    en: {
      feed: 'Fitness thumbnails are all bodies and before-afters, so the differentiator is usually the specific promise: how long, for whom, with what equipment.',
      hook: 'Fitness videos lose people to a warm-up explanation before the workout, or to a form disclaimer that could have come later.',
    },
    tr: {
      feed: "Fitness thumbnail'larının hepsi beden ve önce-sonra; farkı genelde somut vaat yaratır: ne kadar sürede, kimin için, hangi ekipmanla.",
      hook: 'Fitness videoları antrenmandan önceki ısınma anlatımına ya da sonraya kalabilecek bir form uyarısına izleyici kaptırır.',
    },
  },
  vlog: {
    en: {
      feed: 'Vlog thumbnails are faces, and a face only works if the expression is doing something a stranger can name — surprise, effort, dread — at thumbnail size.',
      hook: 'Vlogs lose people to "hey guys, welcome back" before anything has happened.',
    },
    tr: {
      feed: "Vlog thumbnail'ı yüzdür; yüz ise ancak ifade, yabancı birinin adını koyabileceği bir şey yapıyorsa işe yarar — şaşkınlık, çaba, korku.",
      hook: 'Vlog\'lar daha hiçbir şey olmadan söylenen "merhaba arkadaşlar, hoş geldiniz" ile izleyici kaybeder.',
    },
  },
  food: {
    en: {
      feed: 'Food thumbnails compete on appetite at small size: one dish, close, well lit. A full table reads as a grey blur in a feed.',
      hook: 'Cooking videos lose people to a long ingredient list before a single thing is touched.',
    },
    tr: {
      feed: "Yemek thumbnail'ları küçük boyutta iştah üzerinden yarışır: tek yemek, yakın plan, iyi ışık. Dolu bir masa feed'de gri bir bulanıklığa dönüşür.",
      hook: 'Yemek videoları hiçbir şeye dokunulmadan önce okunan uzun malzeme listesine izleyici kaptırır.',
    },
  },
  music: {
    en: {
      feed: 'Music thumbnails have to say genre and mood before they say your name, because a stranger scrolling does not know the name yet.',
      hook: 'Music videos lose people when the first thirty seconds are an intro rather than the part someone would replay.',
    },
    tr: {
      feed: "Müzik thumbnail'ı önce türü ve havayı söylemek zorundadır, adını değil; çünkü kaydıran yabancı adını henüz bilmiyor.",
      hook: 'Müzik videoları ilk otuz saniye, birinin tekrar dinleyeceği kısım yerine bir giriş olduğunda izleyici kaybeder.',
    },
  },
  diy: {
    en: {
      feed: 'DIY thumbnails work when the finished thing is unmistakable at a glance; process shots look like every other process shot in the feed.',
      hook: 'DIY videos lose people to a tool inventory before the first cut, glue or stitch.',
    },
    tr: {
      feed: "Kendin yap thumbnail'ı, bitmiş iş bir bakışta anlaşıldığında işe yarar; süreç kareleri feed'deki diğer bütün süreç karelerine benzer.",
      hook: 'Kendin yap videoları ilk kesim, yapıştırma ya da dikişten önceki alet envanterine izleyici kaptırır.',
    },
  },
  science: {
    en: {
      feed: 'Science thumbnails have to promise a result, not a topic: "what happens if" beats a diagram every time at feed size.',
      hook: 'Science videos lose people when the setup is explained before anyone sees why the result is worth waiting for.',
    },
    tr: {
      feed: 'Bilim thumbnail\'ı konu değil sonuç vaat etmelidir: feed boyutunda "ne olur" her zaman bir şemayı geçer.',
      hook: 'Bilim videoları, sonucun neden beklemeye değer olduğu gösterilmeden düzenek anlatıldığında izleyici kaybeder.',
    },
  },
  comedy: {
    en: {
      feed: 'Comedy thumbnails are a promise of a specific joke; a generic funny face gets scrolled past because it could belong to any video.',
      hook: 'Comedy loses people fastest of all: if nothing lands in the first fifteen seconds, the tab is gone.',
    },
    tr: {
      feed: "Komedi thumbnail'ı belirli bir şakanın vaadidir; genel bir komik surat her videoya ait olabileceği için geçilir.",
      hook: 'Komedi izleyiciyi en hızlı kaybeden türdür: ilk on beş saniyede tutan bir şey yoksa sekme kapanır.',
    },
  },
  travel: {
    en: {
      feed: 'Travel thumbnails all show a beautiful place, so the click usually goes to the one that shows a person in it doing something specific.',
      hook: 'Travel videos lose people to airport footage before arriving anywhere.',
    },
    tr: {
      feed: "Seyahat thumbnail'larının hepsi güzel bir yer gösterir; tıklama genelde içinde belirli bir şey yapan bir insan olanına gider.",
      hook: 'Seyahat videoları henüz hiçbir yere varmadan gösterilen havalimanı görüntülerine izleyici kaptırır.',
    },
  },
  kids: {
    en: {
      feed: 'Kids and family thumbnails are read by a parent first and a child second, so they have to be bright and obviously safe at the same time.',
      hook: 'Family videos lose people to an explanation aimed at parents before the part a child is waiting for.',
    },
    tr: {
      feed: "Çocuk ve aile thumbnail'ını önce ebeveyn okur, sonra çocuk; yani aynı anda hem parlak hem açıkça güvenli görünmek zorundadır.",
      hook: 'Aile videoları, çocuğun beklediği kısımdan önce ebeveyne yapılan açıklamaya izleyici kaptırır.',
    },
  },
};

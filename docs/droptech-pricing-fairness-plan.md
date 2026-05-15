# DropTech Kutu Fiyat Dengesini Daha Adil Hale Getirme Planı

## Problem

Mevcut fiyat mantığı `ceil(expected_value * box.edge + base_fee)` olduğu için yüksek seviye kutularda iki maliyet aynı anda büyüyordu:

- `edge` katsayısı beklenen değeri yüzdesel olarak yukarı çekiyordu.
- `base_fee` sabit bedeli premium kutularda aşırı yükseliyordu.
- Sonuçta bazı kutular oyuncuya “yüksek açma bedeli öde, ortalama değer çok düşük kalabilir” hissi veriyordu.

## Hedef fiyat felsefesi

Yeni hedef, açma bedelini beklenen koleksiyon değerine yaklaştırmak:

```text
Açma bedeli ≈ beklenen değer + küçük sabit fark
```

Bu fark kutu pahalılaştıkça yüzde olarak daha düşük kalmalı. Premium kutu daha pahalı olabilir; ancak “daha iyi item şansı var” gerekçesiyle beklenen değerin çok üstünde şişirilmemeli.

## Hedef oranlar

Her kutu için şu oran takip edilmeli:

```text
beklenen değer / açma bedeli
```

Önerilen bantlar:

| Kutu grubu | Hedef oran | Oyuncu hissi |
| --- | ---: | --- |
| Günlük / başlangıç | `%95 - %105` | Oyuncu lehine veya başa başa yakın |
| Orta seviye | `%85 - %95` | Hafif maliyetli ama makul |
| Premium | `%80 - %90` | Pahalı olabilir; beklenen değer fiyatın çok altında kalmaz |

Hiçbir kutu oyuncuya “46 TC ver, ortalama 13 TC değer al” gibi görünmemeli. Bu nedenle sabit ücretler düşürülmeli, premium kutularda yüzdesel fark sınırlı kalmalı.

## Uygulama adımları

1. **Base fee değerlerini indir**
   - Başlangıç kutusunda `base_fee` sıfıra çekilmeli.
   - Orta kutular düşük sabit farkla kalmalı.
   - Premium kutular için sabit fark 5 TC civarında sınırlanmalı.

2. **Edge katsayısını yumuşat**
   - Başlangıç kutuları `1.00 - 1.03` aralığında kalmalı.
   - Orta kutular `1.04 - 1.06` aralığında kalmalı.
   - Premium kutular `1.07` civarında sınırlandırılmalı.

3. **Her fiyat değişikliğinde oran raporu üret**
   - Kutu adı
   - Beklenen değer
   - Açma bedeli
   - Beklenen değer / açma bedeli oranı
   - Common / Rare / Epic / Legendary / Glitch oranları
   - Toplam item sayısı

4. **Frontend oran şeffaflığını artır**
   Her kutu için oyuncuya açıkça gösterilecek alanlar:
   - Common oranı
   - Rare oranı
   - Epic oranı
   - Legendary oranı
   - Glitch oranı
   - Açma bedeli
   - Ortalama koleksiyon değeri / beklenen değer
   - Beklenen değer / açma bedeli oranı
   - Bu kutudaki toplam item sayısı
   - Bu kutuya özel seri adı

## Kabul kriterleri

- Başlangıç kutuları beklenen değere çok yakın fiyatlanır.
- Orta kutularda maliyet hissi vardır ancak cezalandırıcı değildir.
- Premium kutularda fiyat yüksek olabilir ama beklenen değer fiyatın çok altında kalmaz.
- Oyuncu, kutu açmadan önce oranları ve ekonomik dengeyi açıkça görür.
- Yeni kutu eklenirken fiyat kararı sadece nadirlik şansına değil, beklenen değer / açma bedeli oranına göre de kontrol edilir.

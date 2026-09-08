// prisma/seedCountryDetails.ts
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis'; // hoặc client bạn đang dùng trong RedisService

const prisma = new PrismaClient();

interface CountryDetail {
    countryId: string;
    subtitleVi: string;
    subtitleEn: string;
    prepDaysVi: string;
    prepDaysEn: string;
    costLevelVi: string;
    costLevelEn: string;
    friendlyVi: string;
    friendlyEn: string;
    descriptionVi: string;
    descriptionEn: string;
    // Ảnh danh lam thắng cảnh hiển thị dưới phần "Giới thiệu"
    introGalleryImages: string[];
}

export async function seedCountryDetails() {
    const COUNTRY_DETAILS: CountryDetail[] = [
        {
            countryId: 'japan',
            subtitleVi: 'Xứ sở hoa anh đào và nghệ thuật sống tinh tế.',
            subtitleEn: 'Land of cherry blossoms and refined living.',
            prepDaysVi: '220 ngày',
            prepDaysEn: '220 days',
            costLevelVi: 'Cao',
            costLevelEn: 'High',
            friendlyVi: 'Rất tốt',
            friendlyEn: 'Excellent',
            descriptionVi:
                'Nhật Bản là xứ sở nơi truyền thống ngàn năm hòa quyện cùng nhịp sống hiện đại và công nghệ tiên tiến. Không chỉ cuốn hút bởi những thành phố sôi động, đền chùa cổ kính hay cảnh sắc bốn mùa, Nhật Bản còn sở hữu một văn hóa thú cưng đầy tinh tế. Từ những quán cà phê chó mèo, cửa hàng chuyên biệt đến các dịch vụ chăm sóc đa dạng, tình yêu dành cho những người bạn bốn chân đang trở thành một phần thú vị của phong cách sống Nhật Bản.',
            descriptionEn:
                'Japan is a land where thousand-year traditions blend with a modern, technologically advanced way of life. Beyond its vibrant cities, ancient temples, and four distinct seasons, Japan also has a remarkably refined pet culture. From dog and cat cafés to specialty stores and diverse care services, the love for four-legged companions has become a fascinating part of the Japanese lifestyle.',
            introGalleryImages: [
                'https://images.unsplash.com/photo-1570459027562-4a916cc6113f?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1526481280693-3bfa7568e0f3?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1522383225653-ed111181a951?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=400&auto=format&fit=crop',
            ],
        },
        {
            countryId: 'china',
            subtitleVi: 'Cái nôi của hàng nghìn năm lịch sử và văn hóa.',
            subtitleEn: 'The cradle of thousands of years of history and culture.',
            prepDaysVi: '80 ngày',
            prepDaysEn: '80 days',
            costLevelVi: 'Trung bình',
            costLevelEn: 'Medium',
            friendlyVi: 'Vừa',
            friendlyEn: 'Moderate',
            descriptionVi:
                'Trung Quốc là một quốc gia của sự tương phản đầy kinh ngạc, nơi những giá trị văn hóa truyền thống ngàn năm hòa quyện hoàn hảo cùng tốc độ phát triển công nghệ vượt bậc của thế kỷ 21. Không chỉ thu hút bởi những kỳ quan vĩ đại như Vạn Lý Trường Thành hay những tòa nhà chọc trời tại Thượng Hải, quốc gia này đang chứng kiến một làn sóng bùng nổ của "nền kinh tế thú cưng", biến các đô thị lớn thành những thiên đường giải trí vô cùng độc đáo và hiện đại dành riêng cho hội mê chó mèo.',
            descriptionEn:
                'China is a country of astonishing contrasts, where thousand-year-old cultural traditions blend seamlessly with the extraordinary pace of 21st-century technological development. Beyond great wonders like the Great Wall or the skyscrapers of Shanghai, the country is witnessing a booming "pet economy," turning its major cities into unique, modern playgrounds for dog and cat lovers.',
            introGalleryImages: [
                'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1508804052814-cd3ba865a116?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1470004914212-05527e49370b?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=400&auto=format&fit=crop',
            ],
        },
        {
            countryId: 'vietnam',
            subtitleVi: 'Từng tấc đất đều khắc ghi máu thịt của tự do.',
            subtitleEn: 'Every inch of land is etched with the price of freedom.',
            prepDaysVi: '30 ngày',
            prepDaysEn: '30 days',
            costLevelVi: 'Thấp',
            costLevelEn: 'Low',
            friendlyVi: 'Thấp',
            friendlyEn: 'Low',
            descriptionVi:
                'Việt Nam là một dải đất duyên dáng bên bờ Biển Đông, nơi làm say đắm lòng người bởi cảnh sắc thiên nhiên hùng vĩ, những bãi biển hoang sơ, nền ẩm thực đường phố phong phú và lòng hiếu khách nồng hậu của người dân. Song hành cùng nhịp sống năng động và hiện đại, làn sóng yêu thương và chăm sóc thú cưng tại Việt Nam đang bùng nổ mạnh mẽ hơn bao giờ hết. Từ những quán cà phê chó mèo độc đáo tại các đô thị lớn đến các bãi biển lộng gió mở cửa cho vật nuôi, Việt Nam đang dần chuyển mình thành một điểm đến đầy cởi mở và thú vị cho những hành trình có người bạn bốn chân đồng hành.',
            descriptionEn:
                'Vietnam is a graceful stretch of land along the East Sea, captivating visitors with majestic natural scenery, pristine beaches, rich street food culture, and warm hospitality. Alongside its dynamic, modern pace of life, the wave of love and care for pets in Vietnam is booming stronger than ever. From unique dog and cat cafés in major cities to breezy pet-friendly beaches, Vietnam is gradually becoming an open and exciting destination for journeys with a four-legged companion.',
            introGalleryImages: [
                'https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1509923643151-3b2a94e0e502?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1528181304800-259b08848526?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?q=80&w=400&auto=format&fit=crop',
            ],
        },
        {
            countryId: 'france',
            subtitleVi: 'Nơi nghệ thuật và phong cách sống trở thành một ngôn ngữ riêng.',
            subtitleEn: 'Where art and lifestyle become a language of their own.',
            prepDaysVi: '180 ngày',
            prepDaysEn: '180 days',
            costLevelVi: 'Cao',
            costLevelEn: 'High',
            friendlyVi: 'Rất tốt',
            friendlyEn: 'Excellent',
            descriptionVi:
                'Pháp là một điểm đến huyền thoại nơi sự lãng mạn hòa quyện cùng phong cách sống chậm rãi nghệ thuật. Đối với những người yêu động vật, đây còn là thiên đường thực sự bởi văn hóa "tôn trọng bốn chân" ăn sâu vào máu người dân, biến mỗi góc phố thành một trải nghiệm điện ảnh đầy ấm áp cho cả bạn và người bạn nhỏ.',
            descriptionEn:
                'France is a legendary destination where romance blends with a slow, artistic way of living. For animal lovers, it is also a true paradise, thanks to a deeply rooted culture of "respect for four-legged companions" that turns every street corner into a warm, cinematic experience for you and your little friend.',
            introGalleryImages: [
                'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1499002238440-d264edd596ec?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1500354673957-0331a2cd83e0?q=80&w=400&auto=format&fit=crop',
            ],
        },
        {
            countryId: 'italy',
            subtitleVi: 'Cái nôi của nghệ thuật, thời trang, và ẩm thực',
            subtitleEn: 'The cradle of art, fashion, and cuisine.',
            prepDaysVi: '130 ngày',
            prepDaysEn: '130 days',
            costLevelVi: 'Cao',
            costLevelEn: 'High',
            friendlyVi: 'Rất tốt',
            friendlyEn: 'Excellent',
            descriptionVi:
                'Nước Ý là mảnh đất của nghệ thuật phục hưng, của những công trình kiến trúc cổ kính thách thức thời gian. Đối với những tín đồ mê thú cưng, quốc gia hình chiếc ủng này mang một sức hút vô cùng đặc biệt, nơi tình yêu động vật hòa quyện sâu sắc vào lối sống lãng mạn của người dân bản địa. Tại Ý, thú cưng không chỉ là vật nuôi, mà là những "người bạn tri kỷ" thực thụ, luôn được chào đón nồng nhiệt tại các nhà hàng sang trọng, các bãi biển riêng biệt và thụ hưởng một nền văn hóa chăm sóc đầy tinh tế, đậm chất châu Âu.',
            descriptionEn:
                'Italy is the land of Renaissance art and ancient architecture that defies time. For pet lovers, this boot-shaped country holds a very special appeal, where a love of animals is deeply woven into the romantic lifestyle of the locals. In Italy, pets are not just animals but true "soulmates," warmly welcomed in upscale restaurants and private beaches, enjoying a refined, distinctly European culture of care.',
            introGalleryImages: [
                'https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1523531294919-4bcd7c65e216?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?q=80&w=400&auto=format&fit=crop',
            ],
        },
        {
            countryId: 'egypt',
            subtitleVi: 'Vùng đất của Pharaoh và những kì quan bất tử.',
            subtitleEn: 'The land of Pharaohs and immortal wonders.',
            prepDaysVi: '30 ngày',
            prepDaysEn: '30 days',
            costLevelVi: 'Trung bình',
            costLevelEn: 'Medium',
            friendlyVi: 'Vừa',
            friendlyEn: 'Moderate',
            descriptionVi:
                'Ai Cập là cái nôi của một trong những nền văn minh cổ đại vĩ đại nhất nhân loại, nơi những dòng sông Nile huyền thoại chảy qua các kim tự tháp kiêu hãnh giữa sa mạc mênh mông. Đối với những tín đồ mê thú cưng, Ai Cập mang một ý nghĩa lịch sử vô cùng thiêng liêng: đây chính là nơi loài mèo lần đầu tiên được thuần hóa và từng được tôn sùng như những vị thần (Nữ thần Bastet). Ngày nay, sự giao thoa giữa nét cổ kính ngàn năm và nhịp sống hiện đại tại các thành phố lớn đang mở ra một góc nhìn mới mẻ về văn hóa chăm sóc vật nuôi tại vùng đất Kim Tự Tháp.',
            descriptionEn:
                'Egypt is the cradle of one of humanity\'s greatest ancient civilizations, where the legendary Nile flows past proud pyramids amid a vast desert. For pet lovers, Egypt carries deep historical significance: it is the very place where cats were first domesticated and once worshipped as gods (the goddess Bastet). Today, the blend of ancient heritage and modern city life is opening up a fresh perspective on pet care culture in the land of the pyramids.',
            introGalleryImages: [
                'https://images.unsplash.com/photo-1539768942893-daf53e448371?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1553913861-c0fddf2619ee?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1560840067-ddcaeb7831d1?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1568322445389-f64ac2515020?q=80&w=400&auto=format&fit=crop',
            ],
        },
        {
            countryId: 'greece',
            subtitleVi: 'Vùng đất của những vị thần và ánh nắng Địa Trung Hải',
            subtitleEn: 'Land of the gods and Mediterranean sunshine.',
            prepDaysVi: '130 ngày',
            prepDaysEn: '130 days',
            costLevelVi: 'Cao',
            costLevelEn: 'High',
            friendlyVi: 'Rất tốt',
            friendlyEn: 'Excellent',
            descriptionVi:
                'Hy Lạp là vùng đất thần thoại bên bờ Địa Trung Hải, nơi những ngôi nhà mái vòm xanh trắng tinh khôi nổi bật trên nền biển xanh ngọc bích và các di tích cổ đại kiêu hãnh thách thức thời gian. Không chỉ là cái nôi của văn minh phương Tây, Hy Lạp còn là một thiên đường đầy mê hoặc dành cho các tín đồ mê thú cưng. Hình ảnh những chú mèo lười biếng nằm sưởi nắng trên các bậc thềm đá ở Santorini hay những chú cún thong thả đi dạo cùng chủ qua các khu phố cổ Athens đã trở thành một nét văn hóa đặc trưng, bình yên và vô cùng quyến rũ của quốc gia này.',
            descriptionEn:
                "Greece is a mythical land on the shores of the Mediterranean, where pristine white-and-blue domed houses stand out against turquoise seas and proud ancient ruins defy time. Beyond being the cradle of Western civilization, Greece is also an enchanting paradise for pet lovers. The sight of lazy cats sunbathing on the stone steps of Santorini or dogs strolling leisurely with their owners through the old streets of Athens has become a distinctive, peaceful, and utterly charming part of the country's culture.",
            introGalleryImages: [
                'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1555993539-1732b0258235?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1601581875309-fafbf2d3ed3a?q=80&w=400&auto=format&fit=crop',
            ],
        },
        {
            countryId: 'korea',
            subtitleVi: 'Nơi truyền thống ngàn năm giao thoa cùng nhịp sống hiện đại.',
            subtitleEn: 'Where thousand-year traditions meet a modern pace of life.',
            prepDaysVi: '60 ngày',
            prepDaysEn: '60 days',
            costLevelVi: 'Trung bình',
            costLevelEn: 'Medium',
            friendlyVi: 'Tốt',
            friendlyEn: 'Good',
            descriptionVi:
                'Hàn Quốc là sự hòa quyện tuyệt vời giữa những cung điện cổ kính, những rặng núi thơ mộng và nhịp sống đô thị tương lai rực rỡ ánh đèn led. Không chỉ dẫn đầu thế giới về làn sóng Hallyu, K-Pop hay công nghệ, xứ sở Kim Chi đang chứng kiến cuộc cách mạng "K-Pet" bùng nổ mạnh mẽ. Từ những chiếc xe đẩy thú cưng chạy đầy trên phố Hongdae, các tiệm spa làm đẹp chuẩn idol cho cún, cho đến những khu nghỉ dưỡng biệt lập sang trọng, Hàn Quốc đã nhanh chóng ghi tên mình vào danh sách những thiên đường "cưng chiều" thú cưng bậc nhất châu Á.',
            descriptionEn:
                'South Korea is a wonderful blend of ancient palaces, scenic mountain ranges, and a futuristic urban pace lit up by neon lights. Beyond leading the world in the Hallyu wave, K-Pop, and technology, the "Land of Kimchi" is witnessing a booming "K-Pet" revolution. From pet strollers filling the streets of Hongdae to idol-style grooming spas and exclusive luxury resorts, South Korea has quickly earned its place among Asia\'s top pet-pampering paradises.',
            introGalleryImages: [
                'https://images.unsplash.com/photo-1517154421773-0529f29ea451?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1538485399081-7191377e8241?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1512100356356-de1b84283e18?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1548115184-bc6544d06a58?q=80&w=400&auto=format&fit=crop',
            ],
        },
        {
            countryId: 'germany',
            subtitleVi: 'Xứ sở của những lâu đài, truyện cổ tích, và tinh thần mỹ nghệ.',
            subtitleEn: 'A land of castles, fairy tales, and craftsmanship.',
            prepDaysVi: '130 ngày',
            prepDaysEn: '130 days',
            costLevelVi: 'Cao',
            costLevelEn: 'High',
            friendlyVi: 'Rất tốt',
            friendlyEn: 'Excellent',
            // ⚠️ Lưu ý: nội dung "Giới thiệu" bạn cung cấp cho Đức trùng với nội dung của Hy Lạp.
            // Mình seed đúng như bạn gửi, bạn kiểm tra lại và gửi nội dung đúng cho Đức nếu đây là nhầm lẫn.
            descriptionVi:
                'Hy Lạp là vùng đất thần thoại bên bờ Địa Trung Hải, nơi những ngôi nhà mái vòm xanh trắng tinh khôi nổi bật trên nền biển xanh ngọc bích và các di tích cổ đại kiêu hãnh thách thức thời gian. Không chỉ là cái nôi của văn minh phương Tây, Hy Lạp còn là một thiên đường đầy mê hoặc dành cho các tín đồ mê thú cưng. Hình ảnh những chú mèo lười biếng nằm sưởi nắng trên các bậc thềm đá ở Santorini hay những chú cún thong thả đi dạo cùng chủ qua các khu phố cổ Athens đã trở thành một nét văn hóa đặc trưng, bình yên và vô cùng quyến rũ của quốc gia này.',
            descriptionEn:
                "Greece is a mythical land on the shores of the Mediterranean, where pristine white-and-blue domed houses stand out against turquoise seas and proud ancient ruins defy time. Beyond being the cradle of Western civilization, Greece is also an enchanting paradise for pet lovers. The sight of lazy cats sunbathing on the stone steps of Santorini or dogs strolling leisurely with their owners through the old streets of Athens has become a distinctive, peaceful, and utterly charming part of the country's culture.",
            introGalleryImages: [
                'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1587330979470-3016b6702d89?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1520175480921-4edfa2983e0f?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1560930950-5cc20e80e392?q=80&w=400&auto=format&fit=crop',
            ],
        },
        {
            countryId: 'switzerland',
            subtitleVi: 'Miền đất của dãy Alps, nơi con người sống hài hòa với thiên nhiên.',
            subtitleEn: 'The land of the Alps, where people live in harmony with nature.',
            prepDaysVi: '130 ngày',
            prepDaysEn: '130 days',
            costLevelVi: 'Cao',
            costLevelEn: 'High',
            friendlyVi: 'Rất tốt',
            friendlyEn: 'Excellent',
            descriptionVi:
                'Thụy Sĩ là thiên đường nơi hạ giới với những đỉnh núi phủ tuyết trắng xóa của dãy Alps, những hồ nước trong vắt như gương và các ngôi làng thanh bình đẹp như tranh vẽ. Không chỉ nổi tiếng về đồng hồ, chocolate hay sự thịnh vượng, Thụy Sĩ còn là một trong những quốc gia tiến bộ và văn minh nhất thế giới trong việc bảo vệ quyền lợi động vật. Tại vùng đất này, thú cưng được xem là những "công dân bốn chân" thực thụ, sở hữu những đặc quyền pháp lý tối cao và được tận hưởng một cuộc sống tự do, hòa mình vào thiên nhiên vĩ đại một cách tuyệt đối.',
            descriptionEn:
                'Switzerland is a heaven on earth, with snow-capped Alpine peaks, mirror-clear lakes, and picturesque, peaceful villages. Beyond its fame for watches, chocolate, and prosperity, Switzerland is also one of the world\'s most progressive and civilized countries when it comes to protecting animal welfare. Here, pets are regarded as true "four-legged citizens," enjoying strong legal protections and a free life fully immersed in magnificent nature.',
            introGalleryImages: [
                'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1531973576160-7125cd663d86?q=80&w=400&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1544198365-f5d60b6d8190?q=80&w=400&auto=format&fit=crop',
            ],
        },
    ];

    console.log('Seeding country details (subtitle, prep/cost/friendly, description, gallery)...');

    for (const detail of COUNTRY_DETAILS) {
        const { countryId, ...data } = detail;
        try {
            await prisma.countryProcedure.update({
                where: { id: countryId },
                data: {
                    subtitleVi: data.subtitleVi,
                    subtitleEn: data.subtitleEn,
                    prepDaysVi: data.prepDaysVi,
                    prepDaysEn: data.prepDaysEn,
                    costLevelVi: data.costLevelVi,
                    costLevelEn: data.costLevelEn,
                    friendlyVi: data.friendlyVi,
                    friendlyEn: data.friendlyEn,
                    descriptionVi: data.descriptionVi,
                    descriptionEn: data.descriptionEn,
                    introGalleryImages: data.introGalleryImages,
                },
            });
            console.log(`  ✔ Updated details for "${countryId}"`);
        } catch (err) {
            console.error(`  ✘ Could not update "${countryId}" — has this country been seeded yet?`, err);
        }
    }

    console.log('Done seeding country details!');
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    await redis.del('procedures:countries');
    await redis.quit();
    console.log('🧹 Cleared Redis cache: procedures:countries');
}
seedCountryDetails()
    .catch((e) => {
        console.error('❌ Lỗi khi seed PetHotels:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
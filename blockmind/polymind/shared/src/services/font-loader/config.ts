import { FontFamily, FontStyle, FontWeight } from '@blockmind/polymind-model';
import { z } from 'zod';

export const fontConfigSchema = z.object({
  font: z.string(),
  weight: z.string(),
  url: z.string(),
  style: z.string(),
});

export type FontConfig = z.infer<typeof fontConfigSchema>;

export const PolymindCanvasTextFonts: FontConfig[] = [
  // Inter, https://fonts.cdnfonts.com/css/inter?styles=29139,29134,29135,29136,29140,29141
  {
    font: FontFamily.Inter,
    url: '/assets/fonts/Inter-Light-BETA.woff2',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Inter,
    url: '/assets/fonts/Inter-Regular.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Inter,
    url: '/assets/fonts/Inter-SemiBold.woff2',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Inter,
    url: '/assets/fonts/Inter-LightItalic-BETA.woff2',
    weight: FontWeight.Light,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Inter,
    url: '/assets/fonts/Inter-Italic.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Inter,
    url: '/assets/fonts/Inter-SemiBoldItalic.woff2',
    weight: FontWeight.SemiBold,
    style: FontStyle.Italic,
  },
  // Kalam, https://fonts.cdnfonts.com/css/kalam?styles=15166,170689,170687
  {
    font: FontFamily.Kalam,
    url: '/assets/fonts/Kalam-Light.woff2',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Kalam,
    url: '/assets/fonts/Kalam-Regular.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Kalam,
    url: '/assets/fonts/Kalam-Bold.woff2',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  // Satoshi, https://fonts.cdnfonts.com/css/satoshi?styles=135009,135004,135005,135006,135002,135003
  {
    font: FontFamily.Satoshi,
    url: '/assets/fonts/Satoshi-Light.woff2',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Satoshi,
    url: '/assets/fonts/Satoshi-Regular.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Satoshi,
    url: '/assets/fonts/Satoshi-Bold.woff2',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Satoshi,
    url: '/assets/fonts/Satoshi-LightItalic.woff2',
    weight: FontWeight.Light,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Satoshi,
    url: '/assets/fonts/Satoshi-Italic.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Satoshi,
    url: '/assets/fonts/Satoshi-BoldItalic.woff2',
    weight: FontWeight.SemiBold,
    style: FontStyle.Italic,
  },
  // Poppins, https://fonts.cdnfonts.com/css/poppins?styles=20394,20389,20390,20391,20395,20396
  {
    font: FontFamily.Poppins,
    url: '/assets/fonts/Poppins-Light.woff2',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Poppins,
    url: '/assets/fonts/Poppins-Regular.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Poppins,
    url: '/assets/fonts/Poppins-Medium.woff2',
    weight: FontWeight.Medium,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Poppins,
    url: '/assets/fonts/Poppins-SemiBold.woff2',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Poppins,
    url: '/assets/fonts/Poppins-LightItalic.woff2',
    weight: FontWeight.Light,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Poppins,
    url: '/assets/fonts/Poppins-Italic.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Poppins,
    url: '/assets/fonts/Poppins-SemiBoldItalic.woff2',
    weight: FontWeight.SemiBold,
    style: FontStyle.Italic,
  },
  // Lora, https://fonts.cdnfonts.com/css/lora-4?styles=50357,50356,50354,50355
  {
    font: FontFamily.Lora,
    url: '/assets/fonts/Lora-Regular.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Lora,
    url: '/assets/fonts/Lora-Bold.woff2',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Lora,
    url: '/assets/fonts/Lora-Italic.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Lora,
    url: '/assets/fonts/Lora-BoldItalic.woff2',
    weight: FontWeight.SemiBold,
    style: FontStyle.Italic,
  },
  // BebasNeue, https://fonts.cdnfonts.com/css/bebas-neue?styles=169713,17622,17620
  {
    font: FontFamily.BebasNeue,
    url: '/assets/fonts/BebasNeue-Light.woff2',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.BebasNeue,
    url: '/assets/fonts/BebasNeue-Regular.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  // OrelegaOne, https://fonts.cdnfonts.com/css/orelega-one?styles=148618
  {
    font: FontFamily.OrelegaOne,
    url: '/assets/fonts/OrelegaOne-Regular.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
];

export const CommunityCanvasTextFonts: FontConfig[] = [
  // Inter, https://fonts.cdnfonts.com/css/inter?styles=29139,29134,29135,29136,29140,29141
  {
    font: FontFamily.Inter,
    url: '/assets/fonts/Inter-Light-BETA.woff',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Inter,
    url: '/assets/fonts/Inter-Regular.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Inter,
    url: '/assets/fonts/Inter-SemiBold.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Inter,
    url: '/assets/fonts/Inter-LightItalic-BETA.woff',
    weight: FontWeight.Light,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Inter,
    url: '/assets/fonts/Inter-Italic.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Inter,
    url: '/assets/fonts/Inter-SemiBoldItalic.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Italic,
  },
  // Kalam, https://fonts.cdnfonts.com/css/kalam?styles=15166,170689,170687
  {
    font: FontFamily.Kalam,
    url: '/assets/fonts/Kalam-Light.woff',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Kalam,
    url: '/assets/fonts/Kalam-Regular.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Kalam,
    url: '/assets/fonts/Kalam-Bold.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  // Satoshi, https://fonts.cdnfonts.com/css/satoshi?styles=135009,135004,135005,135006,135002,135003
  {
    font: FontFamily.Satoshi,
    url: '/assets/fonts/Satoshi-Light.woff',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Satoshi,
    url: '/assets/fonts/Satoshi-Regular.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Satoshi,
    url: '/assets/fonts/Satoshi-Bold.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Satoshi,
    url: '/assets/fonts/Satoshi-LightItalic.woff',
    weight: FontWeight.Light,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Satoshi,
    url: '/assets/fonts/Satoshi-Italic.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Satoshi,
    url: '/assets/fonts/Satoshi-BoldItalic.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Italic,
  },
  // Poppins, https://fonts.cdnfonts.com/css/poppins?styles=20394,20389,20390,20391,20395,20396
  {
    font: FontFamily.Poppins,
    url: '/assets/fonts/Poppins-Light.woff',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Poppins,
    url: '/assets/fonts/Poppins-Regular.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Poppins,
    url: '/assets/fonts/Poppins-Medium.woff',
    weight: FontWeight.Medium,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Poppins,
    url: '/assets/fonts/Poppins-SemiBold.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Poppins,
    url: '/assets/fonts/Poppins-LightItalic.woff',
    weight: FontWeight.Light,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Poppins,
    url: '/assets/fonts/Poppins-Italic.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Poppins,
    url: '/assets/fonts/Poppins-SemiBoldItalic.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Italic,
  },
  // Lora, https://fonts.cdnfonts.com/css/lora-4?styles=50357,50356,50354,50355
  {
    font: FontFamily.Lora,
    url: '/assets/fonts/Lora-Regular.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Lora,
    url: '/assets/fonts/Lora-Bold.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Lora,
    url: '/assets/fonts/Lora-Italic.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Lora,
    url: '/assets/fonts/Lora-BoldItalic.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Italic,
  },
  // BebasNeue, https://fonts.cdnfonts.com/css/bebas-neue?styles=169713,17622,17620
  {
    font: FontFamily.BebasNeue,
    url: '/assets/fonts/BebasNeue-Light.woff',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.BebasNeue,
    url: '/assets/fonts/BebasNeue-Regular.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  // OrelegaOne, https://fonts.cdnfonts.com/css/orelega-one?styles=148618
  {
    font: FontFamily.OrelegaOne,
    url: '/assets/fonts/OrelegaOne-Regular.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
];

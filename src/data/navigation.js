export const navItems = [
  { label: 'Products', href: '/products' },
  {
    label: 'Where to find us',
    href: '/where-to-find-us',
    children: [
      { label: 'Direct Sales', href: '/direct-sales' },
      { label: 'Retail', href: '/where-to-find-us' },
      { label: 'Wholesale', href: '/wholesale' },
      { label: 'Markets', href: '/markets' },
    ],
  },
  { label: 'Recipes', href: '/recipes' },
  { label: 'Contact', href: '/contact' },
  { label: 'Compost Club', href: 'https://compostclub.glasgowmushroom.co', external: true },
];
